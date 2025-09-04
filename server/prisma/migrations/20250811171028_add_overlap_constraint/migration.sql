-- Enable extension for equality support
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
ADD CONSTRAINT booking_no_overlap
EXCLUDE USING gist (
  "roomId" WITH =,
  tsrange("startTs", "endTs") WITH &&
) WHERE ("status" = 'CONFIRMED');
