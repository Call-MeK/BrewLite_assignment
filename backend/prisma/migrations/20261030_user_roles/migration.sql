CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');
ALTER TABLE "users" ADD COLUMN "role" "UserRole";
