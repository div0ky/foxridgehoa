/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_bootstrap from "../admin/bootstrap.js";
import type * as admin_invite from "../admin/invite.js";
import type * as admin_provisioning from "../admin/provisioning.js";
import type * as auth from "../auth.js";
import type * as bootstrapFirst from "../bootstrapFirst.js";
import type * as http from "../http.js";
import type * as operatorProfiles from "../operatorProfiles.js";
import type * as operatorProvisioning from "../operatorProvisioning.js";
import type * as operators from "../operators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/bootstrap": typeof admin_bootstrap;
  "admin/invite": typeof admin_invite;
  "admin/provisioning": typeof admin_provisioning;
  auth: typeof auth;
  bootstrapFirst: typeof bootstrapFirst;
  http: typeof http;
  operatorProfiles: typeof operatorProfiles;
  operatorProvisioning: typeof operatorProvisioning;
  operators: typeof operators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
