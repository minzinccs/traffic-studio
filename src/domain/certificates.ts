export type CertificateInfo = {
  id:string; fingerprint:string; pem:string; createdAt:number; expiresAt:number;
  trustedCurrentUser:boolean; captureAttached:boolean;
  installedByApp:boolean; operation:string;
};
