export type OAuthInput={id:string;endpoint:string;grant:string;clientId:string;clientSecret:string;clientAuth:string;scope:string;code:string;redirectUri:string;verifier:string;refreshToken:string};
export type OAuthToken={accessToken:string;refreshToken:string|null;expiresIn:number|null;scope:string|null};
