/** Credentials / config for a Naukri Selenium run. */
export interface NaukriCredentials {
  username: string;
  password: string;
  mobile: string;
  originalResumePath: string;
  modifiedResumePath: string;
  naukriLoginUrl: string;
  naukriProfileUrl: string;
  updatePdf: boolean;
  headless: boolean;
}
