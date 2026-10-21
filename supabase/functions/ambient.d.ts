// Ambient module declarations for Deno URL imports in editor TypeScript
declare module "https://*" {
  const content: any;
  export default content;
  export const serve: any;
  export const createClient: any;
  export * from "any";
}

declare module "npm:*" {
  const content: any;
  export default content;
  export const createClient: any;
  export * from "any";
}

declare module "jsr:*" {
  const content: any;
  export default content;
  export * from "any";
}
