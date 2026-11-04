import { Body, Controller, Get, Header, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { JwtPayload } from "../auth/jwt.strategy";
import { CreateStockImportDto, StockImportIdDto, StockImportsQueryDto } from "./stock-imports.dto";
import { StockImportsService } from "./stock-imports.service";

@Controller("admin/stock-imports")
@UseGuards(JwtAuthGuard, AdminGuard)
export class StockImportsController {
  constructor(private readonly stockImports: StockImportsService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(@Query() query: StockImportsQueryDto) {
    return this.stockImports.list(query);
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  get(@Param() params: StockImportIdDto) {
    return this.stockImports.get(params.id);
  }

  @Post()
  create(@Req() req: { user: JwtPayload }, @Body() dto: CreateStockImportDto) {
    return this.stockImports.create(req.user.sub, dto);
  }
}
