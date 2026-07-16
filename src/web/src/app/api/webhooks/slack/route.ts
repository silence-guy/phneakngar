import { createGatewayWebhookHandler } from "../_gateway";

export const POST = createGatewayWebhookHandler("slack");
