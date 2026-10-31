import createNextIntlPlugin from "next-intl/plugin";
export default createNextIntlPlugin("./src/i18n/request.ts")({
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
});
