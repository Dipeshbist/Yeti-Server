-- AlterTable
ALTER TABLE "public"."Device" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Device_lat_lng_idx" ON "public"."Device"("lat", "lng");

-- CreateIndex
CREATE INDEX "Device_location_idx" ON "public"."Device"("location");
