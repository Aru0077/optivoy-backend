import { Global, Module } from '@nestjs/common';
import { SystemMessageI18nService } from './system-message-i18n.service';

@Global()
@Module({
  providers: [SystemMessageI18nService],
  exports: [SystemMessageI18nService],
})
export class SystemMessageI18nModule {}
