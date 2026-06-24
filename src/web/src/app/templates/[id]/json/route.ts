import { NextResponse } from "next/server";
import { getTemplateById } from "@/lib/templates";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const locale = new URL(req.url).searchParams.get("locale");
  const template = getTemplateById(id, locale);

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  const response = {
    name: template.name,
    scenario: template.baseScenario,
    members: template.members.map((m) => ({
      role: m.role,
      description: m.description,
      instructions: m.instructions,
      ...(m.relationship ? { relationship: m.relationship } : {}),
    })),
  };

  return NextResponse.json(response);
}
