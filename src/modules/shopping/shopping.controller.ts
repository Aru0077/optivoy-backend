import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListShoppingQueryDto } from './dto/list-shopping-query.dto';
import { ShoppingLangQueryDto } from './dto/shopping-lang-query.dto';
import { ShoppingService } from './shopping.service';

@ApiTags('shopping')
@Controller('shopping')
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  @Get()
  listShopping(@Query() query: ListShoppingQueryDto) {
    return this.shoppingService.listShopping(query);
  }

  @Get(':shoppingId')
  getShoppingById(
    @Param('shoppingId') shoppingId: string,
    @Query() query: ShoppingLangQueryDto,
  ) {
    return this.shoppingService.getShoppingById(shoppingId, query.lang);
  }
}
