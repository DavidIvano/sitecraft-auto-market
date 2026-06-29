export const AUTH_TOKEN_KEY = "sitecraft_auto_market_auth_token";
export const AUTH_USER_KEY = "sitecraft_auto_market_user";

export type AuthUser = {
  id?: number;
  name?: string;
  email?: string;
  picture?: string;
  role?: string;
};

export type AuthPayload = {
  authToken?: string;
  token?: string;
  jwt?: string;
  user?: AuthUser;
};
