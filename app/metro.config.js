const { getDefaultConfig } = require("expo/metro-config");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  const { transformer, resolver } = config;
  const isProduction = process.env.NODE_ENV === "production";

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
    // Enable aggressive minification in production
    minifierPath: require.resolve("metro-minify-terser"),
    minifierConfig: isProduction ? {
      // Aggressive minification settings for code obfuscation
      ecma: 2020,
      compress: {
        drop_console: true, // Remove console.log statements
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug"], // Remove specific console methods
        passes: 3, // Multiple passes for better compression
        unsafe: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
        warnings: false
      },
      mangle: {
        toplevel: true, // Mangle top-level variable names
        properties: {
          regex: /^_/ // Mangle properties starting with underscore
        }
      },
      output: {
        comments: false, // Remove all comments
        ascii_only: true, // Ensure ASCII-only output
        beautify: false
      },
      sourceMap: false // Disable source maps in production for better obfuscation
    } : {
      // Development settings - less aggressive
      ecma: 2020,
      compress: false,
      mangle: false,
      output: {
        comments: true,
        beautify: true
      }
    }
  };
  
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...resolver.sourceExts, "svg"]
  };

  return config;
})();
