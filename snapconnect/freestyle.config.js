module.exports = {
  // Project configuration
  name: 'snapconnect',
  type: 'expo',
  
  // Build configuration
  buildCommand: 'npm run build:web',
  outputDirectory: 'dist',
  
  // Environment variables
  env: {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
  },
  
  // Domain configuration (optional)
  // domains: ['your-custom-domain.com'],
  
  // Headers configuration for SPA routing
  headers: [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        }
      ]
    }
  ],
  
  // Redirects for SPA routing
  redirects: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      destination: '/index.html',
      permanent: false
    }
  ]
};