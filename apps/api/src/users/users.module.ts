import { Module } from "@nestjs/common";
import { AssignmentModule } from "../assignment/assignment.module";
import { AuthModule } from "../auth/auth.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuthModule, AssignmentModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
