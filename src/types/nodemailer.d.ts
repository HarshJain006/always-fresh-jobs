declare module "nodemailer" {
  export interface SentMessageInfo {
    messageId?: string;
    accepted?: string[];
    rejected?: string[];
    response?: string;
    [key: string]: unknown;
  }

  export interface Transporter {
    sendMail(mail: Record<string, unknown>): Promise<SentMessageInfo>;
    verify(): Promise<boolean>;
    [key: string]: unknown;
  }

  export function createTransport(options: Record<string, unknown>): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };
  export default nodemailer;
}
