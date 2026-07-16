import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { runNaukriAutomation } from "../../../lib/naukri";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { username, password, mobile, resumeFileName, resumeData, updatePdf } = body;
    if (!username || !password || !mobile || !resumeFileName || !resumeData) {
      return NextResponse.json(
        { success: false, message: "Missing required Naukri account or resume fields." },
        { status: 400 }
      );
    }

    const tempDir = path.join(os.tmpdir(), "dailyresume-naukri");
    await fs.mkdir(tempDir, { recursive: true });

    const resumePath = path.join(tempDir, `${Date.now()}-${resumeFileName}`);
    const resumeBuffer = Buffer.from(resumeData, "base64");
    await fs.writeFile(resumePath, resumeBuffer);

    const result = await runNaukriAutomation({
      username,
      password,
      mobile,
      resumeFilePath: resumePath,
      updatePdf: Boolean(updatePdf),
      modifiedResumePath: path.join(tempDir, `modified-${resumeFileName}`),
      naukriLoginUrl: process.env.NAUKRI_LOGIN_URL,
      naukriProfileUrl: process.env.NAUKRI_PROFILE_URL,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
