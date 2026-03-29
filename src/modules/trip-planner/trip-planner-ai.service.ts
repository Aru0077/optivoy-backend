import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlannerConfig } from '../../config/planner.config';
import {
  AiPlanDay,
  AiPlanItem,
  AiPlanResult,
  PlannerHotelCandidate,
  PlannerInputPoint,
} from './trip-planner.types';

interface GenerateAiPlanInput {
  city: string;
  province: string;
  arrivalDateTime: string;
  tripDays: number;
  preferredReturnDepartureDateTime?: string;
  regenerateInstruction?: string;
  points: PlannerInputPoint[];
  hotels: PlannerHotelCandidate[];
}

interface ChatCompletionResponse {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

interface OpenAiRequestPayloadBase {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  temperature: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
}

type OpenAiResponseFormat =
  | {
      type: 'json_object';
    }
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        strict: true;
        schema: Record<string, unknown>;
      };
    };

interface OpenAiExtraBody {
  enable_thinking?: boolean;
}

interface OpenAiRequestPayload extends OpenAiRequestPayloadBase {
  model: string;
  response_format?: OpenAiResponseFormat;
  enable_thinking?: boolean;
}

type AiProvider = 'deepseek' | 'qwen';

interface ProviderRuntimeConfig {
  provider: AiProvider;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}

interface ProviderCallStrategy {
  label: string;
  responseFormat?: OpenAiResponseFormat;
  extraBody?: OpenAiExtraBody;
  topP?: number;
  omitMaxTokens?: boolean;
}

@Injectable()
export class TripPlannerAiService {
  private readonly config: PlannerConfig;
  private readonly logger = new Logger(TripPlannerAiService.name);
  private readonly datePattern = /^\d{4}-\d{2}-\d{2}$/;
  private readonly timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<PlannerConfig>(
      'planner',
    ) as PlannerConfig;
  }

  async generatePlan(input: GenerateAiPlanInput): Promise<AiPlanResult> {
    this.assertAiEnabled();

    const outputSchema = this.buildOutputSchema(input.tripDays);
    const distanceHints = this.buildDistanceHints(input.points, input.hotels);

    const payload: OpenAiRequestPayloadBase = {
      messages: [
        {
          role: 'system',
          content: [
            '你是专业旅游线路规划助手。',
            '任务：根据用户提供的宾馆、景点、商城，规划最优旅游线路（最优以距离和通勤时间最小为目标）。',
            '规则严格遵守：',
            '1. 每天必须明确：起点（startType/startRefId）、是否退房（checkoutRequired）、当天游览顺序、晚上住宿宾馆（nightHotelId）。',
            '2. 路线必须合理，不走回头路，优先距离更近、通勤更短的顺序。',
            '3. 只使用输入中提供的 ID，不新增任何宾馆、景点、商场。',
            '4. 行程必须从 arrivalDateTime 开始计算，并考虑市内通勤时间。',
            '5. 每个点必须且仅能出现一次，需给出建议游玩时长 suggestedStayMinutes 和上一个节点到该点的 transitMinutesFromPrev。',
            '6. 仅输出 JSON 对象，不要解释，不要闲聊，不要 markdown 代码块。',
            '7. JSON 必须严格符合 expectedOutputSchema，禁止输出额外字段。',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            city: input.city,
            province: input.province,
            arrivalDateTime: input.arrivalDateTime,
            tripDays: input.tripDays,
            preferredReturnDepartureDateTime:
              input.preferredReturnDepartureDateTime ?? null,
            regenerateInstruction: input.regenerateInstruction ?? null,
            selectedPoints: input.points,
            hotelCandidates: input.hotels,
            distanceHints,
            expectedOutputSchema: outputSchema,
          }),
        },
      ],
      temperature: 0.2,
      max_tokens: this.resolveMaxTokens(input.tripDays),
      frequency_penalty: 0,
      presence_penalty: 0,
    };

    return this.callAiApiWithFallback(payload, input, outputSchema);
  }

  private buildOutputSchema(tripDays: number): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'itineraryTitle',
        'summary',
        'checkInDate',
        'checkOutDate',
        'returnDepartureDateTime',
        'days',
      ],
      properties: {
        itineraryTitle: { type: 'string', minLength: 1, maxLength: 200 },
        summary: { type: 'string', minLength: 1, maxLength: 5000 },
        checkInDate: {
          type: 'string',
          pattern: '^\\\\d{4}-\\\\d{2}-\\\\d{2}$',
        },
        checkOutDate: {
          type: 'string',
          pattern: '^\\\\d{4}-\\\\d{2}-\\\\d{2}$',
        },
        returnDepartureDateTime: {
          type: 'string',
          minLength: 10,
          maxLength: 40,
        },
        days: {
          type: 'array',
          minItems: tripDays,
          maxItems: tripDays,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'date',
              'startType',
              'startRefId',
              'checkoutRequired',
              'nightHotelId',
              'hotelReason',
              'items',
            ],
            properties: {
              date: {
                type: 'string',
                pattern: '^\\\\d{4}-\\\\d{2}-\\\\d{2}$',
              },
              startType: {
                type: 'string',
                enum: ['arrival', 'hotel'],
              },
              startRefId: {
                anyOf: [
                  { type: 'string', minLength: 1, maxLength: 64 },
                  { type: 'null' },
                ],
              },
              checkoutRequired: { type: 'boolean' },
              nightHotelId: {
                type: 'string',
                minLength: 1,
                maxLength: 64,
              },
              hotelReason: {
                type: 'string',
                minLength: 1,
                maxLength: 2000,
              },
              items: {
                type: 'array',
                minItems: 0,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'pointType',
                    'refId',
                    'startTime',
                    'endTime',
                    'suggestedStayMinutes',
                    'transitMinutesFromPrev',
                    'reason',
                  ],
                  properties: {
                    pointType: {
                      type: 'string',
                      enum: ['spot', 'shopping'],
                    },
                    refId: {
                      type: 'string',
                      minLength: 1,
                      maxLength: 64,
                    },
                    startTime: {
                      type: 'string',
                      pattern: '^([01]\\\\d|2[0-3]):[0-5]\\\\d$',
                    },
                    endTime: {
                      type: 'string',
                      pattern: '^([01]\\\\d|2[0-3]):[0-5]\\\\d$',
                    },
                    suggestedStayMinutes: {
                      type: 'integer',
                      minimum: 10,
                      maximum: 720,
                    },
                    transitMinutesFromPrev: {
                      type: 'integer',
                      minimum: 0,
                      maximum: 360,
                    },
                    reason: {
                      type: 'string',
                      minLength: 1,
                      maxLength: 2000,
                    },
                  },
                },
              },
            },
          },
        },
      },
    } satisfies Record<string, unknown>;
  }

  private buildDistanceHints(
    points: PlannerInputPoint[],
    hotels: PlannerHotelCandidate[],
  ): Record<string, unknown> {
    const pointHints = points.map((point) => ({
      pointId: point.id,
      pointType: point.pointType,
      nearestPoints: points
        .filter((item) => item.id !== point.id)
        .map((item) => ({
          pointType: item.pointType,
          pointId: item.id,
          transitMinutes: this.estimateTransitMinutes(
            point.latitude,
            point.longitude,
            item.latitude,
            item.longitude,
          ),
        }))
        .sort((a, b) => a.transitMinutes - b.transitMinutes)
        .slice(0, 6),
      nearestHotels: hotels
        .map((hotel) => ({
          hotelId: hotel.id,
          transitMinutes: this.estimateTransitMinutes(
            point.latitude,
            point.longitude,
            hotel.latitude,
            hotel.longitude,
          ),
        }))
        .sort((a, b) => a.transitMinutes - b.transitMinutes)
        .slice(0, 4),
    }));

    const hotelHints = hotels.map((hotel) => ({
      hotelId: hotel.id,
      nearestPoints: points
        .map((point) => ({
          pointType: point.pointType,
          pointId: point.id,
          transitMinutes: this.estimateTransitMinutes(
            hotel.latitude,
            hotel.longitude,
            point.latitude,
            point.longitude,
          ),
        }))
        .sort((a, b) => a.transitMinutes - b.transitMinutes)
        .slice(0, 8),
      nearestHotels: hotels
        .filter((item) => item.id !== hotel.id)
        .map((item) => ({
          hotelId: item.id,
          transitMinutes: this.estimateTransitMinutes(
            hotel.latitude,
            hotel.longitude,
            item.latitude,
            item.longitude,
          ),
        }))
        .sort((a, b) => a.transitMinutes - b.transitMinutes)
        .slice(0, 4),
    }));

    return {
      assumptions: {
        mode: 'intra-city-driving',
        baseSpeedKmh: 25,
        fixedOverheadMinutes: 8,
        unknownCoordinateTransitMinutes: 45,
      },
      byPoint: pointHints,
      byHotel: hotelHints,
    };
  }

  private resolveMaxTokens(tripDays: number): number {
    const value = 960 + tripDays * 480;
    return Math.min(8192, Math.max(1200, value));
  }

  private estimateTransitMinutes(
    fromLat: number | null,
    fromLng: number | null,
    toLat: number | null,
    toLng: number | null,
  ): number {
    if (
      fromLat === null ||
      fromLng === null ||
      toLat === null ||
      toLng === null
    ) {
      return 45;
    }
    const km = this.haversineKm(fromLat, fromLng, toLat, toLng);
    const drivingMinutes = (km / 25) * 60;
    return Math.max(8, Math.round(drivingMinutes + 8));
  }

  private haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private assertAiEnabled(): void {
    if (!this.config.aiEnabled) {
      throw new ServiceUnavailableException({
        code: 'ITINERARY_AI_DISABLED',
        message: 'Itinerary AI generation is disabled on this server.',
      });
    }
    if (!this.config.deepseekApiKey) {
      throw new ServiceUnavailableException({
        code: 'ITINERARY_AI_MISCONFIGURED',
        message: 'DeepSeek API key is missing.',
      });
    }
    if (!this.config.qwenApiKey) {
      throw new ServiceUnavailableException({
        code: 'ITINERARY_AI_MISCONFIGURED',
        message: 'Qwen API key is missing.',
      });
    }
  }

  private async callAiApiWithFallback(
    payloadBase: OpenAiRequestPayloadBase,
    input: GenerateAiPlanInput,
    outputSchema: Record<string, unknown>,
  ): Promise<AiPlanResult> {
    const providers = this.getProviderOrder();
    const errors: string[] = [];

    for (const provider of providers) {
      const strategies = this.getProviderStrategies(provider, outputSchema);
      let providerSucceeded = false;

      for (const strategy of strategies) {
        try {
          const responseBody = await this.callProviderApi(
            provider,
            payloadBase,
            strategy,
          );
          const extracted =
            this.extractJsonCandidatesFromResponse(responseBody);
          const parsedCandidates = this.parsePlanJsonCandidates(
            extracted.candidates,
            extracted.finishReason,
          );
          const normalized = this.validateParsedPlanCandidates(
            parsedCandidates,
            input,
          );
          providerSucceeded = true;
          return normalized;
        } catch (error) {
          const message = this.describeError(error);
          this.logger.warn(
            `AI provider ${provider.provider} strategy ${strategy.label} failed for trip generation: ${message}`,
          );
          errors.push(`[${provider.provider}/${strategy.label}] ${message}`);
        }
      }

      if (!providerSucceeded) {
        const message = `all strategies failed (${provider.provider})`;
        this.logger.warn(
          `AI provider ${provider.provider} failed for trip generation: ${message}`,
        );
      }
    }

    this.logger.error(
      `All AI providers failed for trip generation: ${errors.join(' | ')}`,
    );

    throw new ServiceUnavailableException({
      code: 'ITINERARY_AI_REQUEST_FAILED',
      message:
        'Failed to generate itinerary with DeepSeek and fallback Qwen providers.',
      details: errors,
    });
  }

  private describeError(error: unknown): string {
    if (
      error instanceof BadRequestException ||
      error instanceof ServiceUnavailableException
    ) {
      const response = error.getResponse();
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response &&
        typeof (response as { message?: unknown }).message === 'string'
      ) {
        return (response as { message: string }).message;
      }
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }

  private getProviderOrder(): ProviderRuntimeConfig[] {
    const deepseek: ProviderRuntimeConfig = {
      provider: 'deepseek',
      apiBaseUrl: this.config.deepseekApiBaseUrl,
      apiKey: this.config.deepseekApiKey,
      model: this.config.deepseekModel,
    };
    const qwen: ProviderRuntimeConfig = {
      provider: 'qwen',
      apiBaseUrl: this.config.qwenApiBaseUrl,
      apiKey: this.config.qwenApiKey,
      model: this.config.qwenModel,
    };

    if (this.config.aiPrimaryProvider === 'qwen') {
      return [qwen, deepseek];
    }
    return [deepseek, qwen];
  }

  private async callProviderApi(
    provider: ProviderRuntimeConfig,
    payloadBase: OpenAiRequestPayloadBase,
    strategy: ProviderCallStrategy,
  ): Promise<string> {
    const endpoint = provider.apiBaseUrl.replace(/\/+$/, '');
    const url = `${endpoint}/chat/completions`;
    const { max_tokens: maxTokens, ...payloadBaseWithoutMaxTokens } =
      payloadBase;
    const payload: OpenAiRequestPayload = {
      ...payloadBaseWithoutMaxTokens,
      ...(!strategy.omitMaxTokens && maxTokens !== undefined
        ? { max_tokens: maxTokens }
        : {}),
      model: provider.model,
      ...(strategy.topP !== undefined ? { top_p: strategy.topP } : {}),
      ...(strategy.responseFormat
        ? { response_format: strategy.responseFormat }
        : {}),
      ...(strategy.extraBody ?? {}),
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.aiMaxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, this.config.aiTimeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `${provider.provider} API ${response.status}: ${body}`,
          );
        }

        return await response.text();
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(
            `${provider.provider}(${strategy.label}) request timeout after ${this.config.aiTimeoutMs}ms`,
          );
        } else {
          lastError = error;
        }
        if (attempt >= this.config.aiMaxRetries) {
          break;
        }
      }
    }

    throw new Error(
      lastError instanceof Error ? lastError.message : 'Unknown error',
    );
  }

  private getProviderStrategies(
    provider: ProviderRuntimeConfig,
    outputSchema: Record<string, unknown>,
  ): ProviderCallStrategy[] {
    if (provider.provider === 'deepseek') {
      return [
        {
          label: 'json_object',
          responseFormat: { type: 'json_object' },
        },
        {
          label: 'prompt_only',
        },
      ];
    }

    return [
      {
        label: 'json_schema',
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'trip_itinerary',
            strict: true,
            schema: outputSchema,
          },
        },
        extraBody: { enable_thinking: false },
        topP: 0.4,
        omitMaxTokens: true,
      },
      {
        label: 'json_object',
        responseFormat: { type: 'json_object' },
        extraBody: { enable_thinking: false },
        topP: 0.4,
        omitMaxTokens: true,
      },
    ];
  }

  private extractJsonCandidatesFromResponse(rawBody: string): {
    candidates: string[];
    finishReason: string | null;
  } {
    let payload: ChatCompletionResponse;
    try {
      payload = JSON.parse(rawBody) as ChatCompletionResponse;
    } catch {
      throw new ServiceUnavailableException({
        code: 'ITINERARY_AI_RESPONSE_INVALID',
        message: 'AI response body is not valid JSON.',
      });
    }

    const choice = payload.choices?.[0];
    const finishReason = choice?.finish_reason ?? null;
    const contentSources: string[] = [];
    const pushSource = (value: unknown) => {
      if (typeof value !== 'string') {
        return;
      }
      const text = value.trim();
      if (text) {
        contentSources.push(text);
      }
    };

    const content = choice?.message?.content;
    if (typeof content === 'string') {
      pushSource(content);
    } else if (Array.isArray(content)) {
      const merged = content
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('')
        .trim();
      pushSource(merged);
    }
    pushSource(choice?.message?.reasoning_content ?? null);
    for (const toolCall of choice?.message?.tool_calls ?? []) {
      pushSource(toolCall?.function?.arguments ?? null);
    }

    if (contentSources.length === 0) {
      throw new ServiceUnavailableException({
        code: 'ITINERARY_AI_RESPONSE_EMPTY',
        message:
          'AI response does not contain message content or tool call arguments.',
      });
    }

    const allCandidates = new Set<string>();
    for (const source of contentSources) {
      for (const candidate of this.collectJsonCandidates(source)) {
        allCandidates.add(candidate);
      }
    }

    return {
      candidates: Array.from(allCandidates),
      finishReason,
    };
  }

  private parsePlanJsonCandidates(
    candidates: string[],
    finishReason: string | null,
  ): unknown[] {
    const parsedResults: unknown[] = [];

    for (const candidate of candidates) {
      try {
        let parsed = JSON.parse(candidate) as unknown;
        if (typeof parsed === 'string') {
          const nested = parsed.trim();
          if (
            (nested.startsWith('{') && nested.endsWith('}')) ||
            (nested.startsWith('[') && nested.endsWith(']'))
          ) {
            parsed = JSON.parse(nested) as unknown;
          }
        }
        parsedResults.push(parsed);
      } catch {
        // try next candidate
      }
    }

    if (parsedResults.length > 0) {
      return parsedResults;
    }

    if (finishReason === 'length') {
      throw new BadRequestException({
        code: 'ITINERARY_AI_OUTPUT_INVALID',
        message:
          'AI output is not valid JSON because the response was truncated (finish_reason=length).',
      });
    }

    throw new BadRequestException({
      code: 'ITINERARY_AI_OUTPUT_INVALID',
      message: 'AI output is not valid JSON.',
    });
  }

  private validateParsedPlanCandidates(
    parsedCandidates: unknown[],
    input: GenerateAiPlanInput,
  ): AiPlanResult {
    let lastValidationError: unknown = null;

    for (const candidate of parsedCandidates) {
      try {
        return this.validateAndNormalizePlan(candidate, input);
      } catch (error) {
        lastValidationError = error;
      }
    }

    if (lastValidationError) {
      if (lastValidationError instanceof Error) {
        throw lastValidationError;
      }
      throw new BadRequestException({
        code: 'ITINERARY_AI_OUTPUT_INVALID',
        message: this.describeError(lastValidationError),
      });
    }

    throw new BadRequestException({
      code: 'ITINERARY_AI_OUTPUT_INVALID',
      message: 'AI output is not valid JSON.',
    });
  }

  private collectJsonCandidates(raw: string): string[] {
    const normalized = raw.replace(/^\uFEFF/, '').trim();
    const set = new Set<string>();
    const push = (value: string | null | undefined) => {
      const text = typeof value === 'string' ? value.trim() : '';
      if (text) {
        set.add(text);
      }
    };

    push(normalized);

    const withoutThinkingTags = normalized
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
    push(withoutThinkingTags);

    const wrappedFence = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (wrappedFence) {
      push(wrappedFence[1]);
    }

    const anyFence = normalized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (anyFence) {
      push(anyFence[1]);
    }

    for (const candidate of this.extractBalancedJsonCandidates(
      normalized,
      '{',
      '}',
    )) {
      push(candidate);
    }
    for (const candidate of this.extractBalancedJsonCandidates(
      normalized,
      '[',
      ']',
    )) {
      push(candidate);
    }

    return Array.from(set);
  }

  private extractBalancedJsonCandidates(
    text: string,
    openChar: '{' | '[',
    closeChar: '}' | ']',
  ): string[] {
    const results: string[] = [];
    let startIndex = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === openChar) {
        if (depth === 0) {
          startIndex = index;
        }
        depth += 1;
        continue;
      }

      if (char === closeChar && depth > 0) {
        depth -= 1;
        if (depth === 0 && startIndex >= 0) {
          results.push(text.slice(startIndex, index + 1));
          startIndex = -1;
        }
      }
    }

    return results;
  }

  private validateAndNormalizePlan(
    raw: unknown,
    input: GenerateAiPlanInput,
  ): AiPlanResult {
    if (typeof raw !== 'object' || raw === null) {
      this.throwInvalidOutput('AI output root must be an object.');
    }
    const body = raw as Record<string, unknown>;

    const itineraryTitle = this.readString(
      body.itineraryTitle,
      'itineraryTitle',
      200,
    );
    const summary = this.readString(body.summary, 'summary', 5000);
    const checkInDate = this.readDate(body.checkInDate, 'checkInDate');
    const checkOutDate = this.readDate(body.checkOutDate, 'checkOutDate');
    if (checkOutDate <= checkInDate) {
      this.throwInvalidOutput('checkOutDate must be later than checkInDate.');
    }

    const returnDepartureDateTime = this.readDateTime(
      body.returnDepartureDateTime,
      'returnDepartureDateTime',
    );
    const arrivalDateTime = this.readDateTime(
      input.arrivalDateTime,
      'arrivalDateTime',
    );
    const arrivalDate = arrivalDateTime.slice(0, 10);
    const arrivalTime = arrivalDateTime.slice(11, 16);

    if (!Array.isArray(body.days) || body.days.length === 0) {
      this.throwInvalidOutput('days must be a non-empty array.');
    }

    const validHotelIds = new Set(input.hotels.map((item) => item.id));
    const validPoints = new Map(
      input.points.map((item) => [`${item.pointType}:${item.id}`, item]),
    );

    const usedPointKeys = new Set<string>();
    const usedDates = new Set<string>();

    const days = body.days.map((item, dayIndex) => {
      if (typeof item !== 'object' || item === null) {
        this.throwInvalidOutput(`days[${dayIndex}] must be an object.`);
      }
      const day = item as Record<string, unknown>;

      const date = this.readDate(day.date, `days[${dayIndex}].date`);
      if (usedDates.has(date)) {
        this.throwInvalidOutput(`Duplicate day date ${date}.`);
      }
      usedDates.add(date);

      const startType = this.readStartType(
        day.startType,
        `days[${dayIndex}].startType`,
      );
      const startRefId = this.readStartRefId(
        day.startRefId,
        `days[${dayIndex}].startRefId`,
      );
      if (startType === 'arrival') {
        if (dayIndex > 0) {
          this.throwInvalidOutput(
            `days[${dayIndex}].startType can only be "arrival" on day 1.`,
          );
        }
        if (startRefId !== null) {
          this.throwInvalidOutput(
            `days[${dayIndex}].startRefId must be null when startType is "arrival".`,
          );
        }
      }
      if (startType === 'hotel') {
        if (!startRefId) {
          this.throwInvalidOutput(
            `days[${dayIndex}].startRefId is required when startType is "hotel".`,
          );
        }
        if (!validHotelIds.has(startRefId)) {
          this.throwInvalidOutput(
            `Unknown startRefId in day ${date}: ${startRefId}.`,
          );
        }
      }

      const checkoutRequired = this.readBoolean(
        day.checkoutRequired,
        `days[${dayIndex}].checkoutRequired`,
      );

      const nightHotelId = this.readString(
        day.nightHotelId ?? day.hotelId,
        `days[${dayIndex}].nightHotelId`,
        64,
      );
      if (!validHotelIds.has(nightHotelId)) {
        this.throwInvalidOutput(
          `Unknown nightHotelId in day ${date}: ${nightHotelId}.`,
        );
      }

      const hotelReason = this.readString(
        day.hotelReason,
        `days[${dayIndex}].hotelReason`,
        2000,
      );

      if (!Array.isArray(day.items)) {
        this.throwInvalidOutput(`days[${dayIndex}].items must be an array.`);
      }

      const items = day.items.map((entry, itemIndex) => {
        if (typeof entry !== 'object' || entry === null) {
          this.throwInvalidOutput(
            `days[${dayIndex}].items[${itemIndex}] must be an object.`,
          );
        }
        const itemBody = entry as Record<string, unknown>;

        const pointType = itemBody.pointType;
        if (pointType !== 'spot' && pointType !== 'shopping') {
          this.throwInvalidOutput(
            `days[${dayIndex}].items[${itemIndex}].pointType is invalid.`,
          );
        }

        const refId = this.readString(
          itemBody.refId,
          `days[${dayIndex}].items[${itemIndex}].refId`,
          64,
        );

        const pointKey = `${pointType}:${refId}`;
        if (!validPoints.has(pointKey)) {
          this.throwInvalidOutput(`Unknown point id: ${pointKey}.`);
        }
        if (usedPointKeys.has(pointKey)) {
          this.throwInvalidOutput(`Duplicated point in output: ${pointKey}.`);
        }
        usedPointKeys.add(pointKey);

        const startTime = this.readTime(
          itemBody.startTime,
          `days[${dayIndex}].items[${itemIndex}].startTime`,
        );
        const endTime = this.readTime(
          itemBody.endTime,
          `days[${dayIndex}].items[${itemIndex}].endTime`,
        );
        if (endTime <= startTime) {
          this.throwInvalidOutput(
            `days[${dayIndex}].items[${itemIndex}] endTime must be later than startTime.`,
          );
        }

        const suggestedStayMinutes = this.readInteger(
          itemBody.suggestedStayMinutes,
          `days[${dayIndex}].items[${itemIndex}].suggestedStayMinutes`,
          10,
          720,
        );

        const transitMinutesFromPrev = this.readInteger(
          itemBody.transitMinutesFromPrev,
          `days[${dayIndex}].items[${itemIndex}].transitMinutesFromPrev`,
          0,
          360,
        );

        const reason = this.readString(
          itemBody.reason,
          `days[${dayIndex}].items[${itemIndex}].reason`,
          2000,
        );

        return {
          pointType,
          refId,
          startTime,
          endTime,
          suggestedStayMinutes,
          transitMinutesFromPrev,
          reason,
        } satisfies AiPlanItem;
      });

      return {
        date,
        startType,
        startRefId,
        checkoutRequired,
        nightHotelId,
        hotelId: nightHotelId,
        hotelReason,
        items,
      } satisfies AiPlanDay;
    });

    if (days.length !== input.tripDays) {
      this.throwInvalidOutput(
        `days length must equal tripDays (${input.tripDays}).`,
      );
    }

    for (let index = 0; index < days.length; index += 1) {
      const expectedDate = this.addDays(arrivalDate, index);
      if (days[index].date !== expectedDate) {
        this.throwInvalidOutput(`days[${index}].date must be ${expectedDate}.`);
      }
      if (index > 0 && days[index].startType !== 'hotel') {
        this.throwInvalidOutput(`days[${index}].startType must be "hotel".`);
      }

      let previousEndTime: string | null = null;
      for (
        let itemIndex = 0;
        itemIndex < days[index].items.length;
        itemIndex += 1
      ) {
        const item = days[index].items[itemIndex];
        if (previousEndTime !== null && item.startTime < previousEndTime) {
          this.throwInvalidOutput(
            `days[${index}].items[${itemIndex}] overlaps or is out of order.`,
          );
        }
        previousEndTime = item.endTime;

        if (index === 0 && item.startTime < arrivalTime) {
          this.throwInvalidOutput(
            `days[0].items[${itemIndex}].startTime is earlier than arrival time.`,
          );
        }
      }

      if (days[index].startType === 'hotel') {
        const startHotelId = days[index].startRefId;
        if (!startHotelId) {
          this.throwInvalidOutput(
            `days[${index}].startRefId is required when startType is "hotel".`,
          );
        }
        if (!validHotelIds.has(startHotelId)) {
          this.throwInvalidOutput(
            `days[${index}].startRefId must reference a valid hotel.`,
          );
        }
      }
    }

    const firstDayDate = days[0].date;
    const lastDayDate = days[days.length - 1].date;
    if (checkInDate > firstDayDate) {
      this.throwInvalidOutput(
        'checkInDate cannot be later than first itinerary day.',
      );
    }
    if (checkOutDate <= lastDayDate) {
      this.throwInvalidOutput(
        'checkOutDate must be later than last itinerary day.',
      );
    }
    if (returnDepartureDateTime.slice(0, 10) < lastDayDate) {
      this.throwInvalidOutput(
        'returnDepartureDateTime cannot be earlier than last itinerary day.',
      );
    }

    if (usedPointKeys.size !== validPoints.size) {
      this.throwInvalidOutput(
        'AI output must include each selected point exactly once.',
      );
    }

    return {
      itineraryTitle,
      summary,
      checkInDate,
      checkOutDate,
      returnDepartureDateTime,
      days,
    };
  }

  private readString(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== 'string') {
      this.throwInvalidOutput(`${field} must be a string.`);
    }
    const text = value.trim();
    if (!text) {
      this.throwInvalidOutput(`${field} cannot be empty.`);
    }
    if (text.length > maxLength) {
      this.throwInvalidOutput(`${field} is too long.`);
    }
    return text;
  }

  private readStartType(value: unknown, field: string): 'arrival' | 'hotel' {
    if (value === 'arrival' || value === 'hotel') {
      return value;
    }
    this.throwInvalidOutput(`${field} must be "arrival" or "hotel".`);
  }

  private readStartRefId(value: unknown, field: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return this.readString(value, field, 64);
  }

  private readBoolean(value: unknown, field: string): boolean {
    if (typeof value !== 'boolean') {
      this.throwInvalidOutput(`${field} must be a boolean.`);
    }
    return value;
  }

  private readInteger(
    value: unknown,
    field: string,
    min: number,
    max: number,
  ): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      this.throwInvalidOutput(`${field} must be an integer.`);
    }
    if (value < min || value > max) {
      this.throwInvalidOutput(`${field} must be between ${min} and ${max}.`);
    }
    return value;
  }

  private readDate(value: unknown, field: string): string {
    const text = this.readString(value, field, 32);
    if (!this.datePattern.test(text)) {
      this.throwInvalidOutput(`${field} must match YYYY-MM-DD.`);
    }
    const parsed = Date.parse(`${text}T00:00:00.000Z`);
    if (!Number.isFinite(parsed)) {
      this.throwInvalidOutput(`${field} is not a valid date.`);
    }
    return text;
  }

  private readTime(value: unknown, field: string): string {
    const text = this.readString(value, field, 8);
    if (!this.timePattern.test(text)) {
      this.throwInvalidOutput(`${field} must match HH:MM.`);
    }
    return text;
  }

  private readDateTime(value: unknown, field: string): string {
    const text = this.readString(value, field, 64);
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) {
      this.throwInvalidOutput(`${field} must be a valid ISO datetime string.`);
    }
    return new Date(parsed).toISOString();
  }

  private addDays(date: string, days: number): string {
    const parsed = Date.parse(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed)) {
      this.throwInvalidOutput(`Invalid date arithmetic source: ${date}.`);
    }
    const next = new Date(parsed + days * 24 * 60 * 60 * 1000);
    return next.toISOString().slice(0, 10);
  }

  private throwInvalidOutput(message: string): never {
    throw new BadRequestException({
      code: 'ITINERARY_AI_OUTPUT_INVALID',
      message,
    });
  }
}
