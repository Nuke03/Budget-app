import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Su Vercel ogni deploy ha un id: il client con codice vecchio ricarica da solo.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
};

export default nextConfig;
