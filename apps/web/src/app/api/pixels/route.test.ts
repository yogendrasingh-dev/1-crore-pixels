import { chunkBounds } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "@/lib/test-support";
import { GET } from "./route";

const ALLOWED_FIELDS = ["chunkId", "bounds", "allocations"].sort();
const ALLOWED_ALLOCATION_FIELDS = ["start", "end", "displayName", "anonymous"].sort();

describe("GET /api/pixels?chunk= (docs/API.md §2.6)", () => {
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    fixture = undefined;
  });

  it("returns exactly the documented fields for a chunk with a published allocation", async () => {
    const chunkId = "chunk_500";
    const bounds = chunkBounds(chunkId);
    fixture = await createTestContribution({ status: "PUBLISHED", amountPaise: 500n });
    await prisma.pixelAllocation.create({
      data: { contributionId: fixture.contribution.id, startPixel: bounds.start, endPixel: bounds.start + 5n },
    });

    const response = await GET(new NextRequest(`http://localhost/api/pixels?chunk=${chunkId}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(ALLOWED_FIELDS);
    expect(body.bounds).toMatchObject({ chunkIndex: 500 });
    expect(body.allocations).toHaveLength(1);
    expect(Object.keys(body.allocations[0]).sort()).toEqual(ALLOWED_ALLOCATION_FIELDS);
    expect(body.allocations[0]).toMatchObject({
      start: Number(bounds.start),
      end: Number(bounds.start) + 5,
      anonymous: false,
    });
  });

  it("never includes an allocation belonging to an unpublished contribution", async () => {
    const chunkId = "chunk_501";
    const bounds = chunkBounds(chunkId);
    fixture = await createTestContribution({ status: "PIXELS_ASSIGNED", amountPaise: 500n });
    await prisma.pixelAllocation.create({
      data: { contributionId: fixture.contribution.id, startPixel: bounds.start, endPixel: bounds.start + 5n },
    });

    const response = await GET(new NextRequest(`http://localhost/api/pixels?chunk=${chunkId}`));
    const body = await response.json();

    expect(body.allocations).toHaveLength(0);
  });

  it("rejects a malformed chunkId with 422", async () => {
    const response = await GET(new NextRequest("http://localhost/api/pixels?chunk=not-a-chunk"));
    expect(response.status).toBe(422);
  });

  it("requires the chunk query parameter", async () => {
    const response = await GET(new NextRequest("http://localhost/api/pixels"));
    expect(response.status).toBe(422);
  });
});
