module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "@sentry/cli" || pkg.name === "protobufjs") {
        pkg.allowBuild = true;
      }
      return pkg;
    },
  },
};
