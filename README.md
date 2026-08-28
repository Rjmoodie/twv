# SomaTech - Real Estate Investment Platform

A comprehensive real estate investment platform with integrated LMS, subscription management, and advanced analytics.

## 🚀 Live Demo

- **Production**: [Coming Soon]
- **Development**: http://localhost:8081

## 📋 Features

### Core Modules
- **Real Estate Analytics** - Market analysis, property valuation, investment calculations
- **Lead Generation** - Automated lead scoring and management
- **Course LMS** - Integrated learning management system with CourseLit
- **Subscription Management** - Tiered access control with Stripe integration
- **Admin Dashboard** - User management, course management, analytics
- **Discord Integration** - Role-based community access

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Payments**: Stripe (Subscriptions, Checkout, Customer Portal)
- **Maps**: Google Maps API, Mapbox
- **Data**: Alpha Vantage API, Real Estate APIs
- **Deployment**: Vercel, Supabase

## 🛠️ Local Development

### Prerequisites
- Node.js 22+
- npm/yarn/pnpm
- Supabase account
- Stripe account (for payments)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd somatech
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your environment variables:
   - Supabase project URL and keys
   - Stripe secret keys and price IDs
   - API keys for external services

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:8081
   - Supabase Dashboard: Your project dashboard

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret key | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | ✅ |
| `STRIPE_TIER1_PRICE_ID` | Stripe price ID for Tier 1 | ✅ |
| `STRIPE_TIER2_PRICE_ID` | Stripe price ID for Tier 2 | ✅ |
| `STRIPE_TIER3_PRICE_ID` | Stripe price ID for Tier 3 | ✅ |
| `VITE_ALPHA_VANTAGE_API_KEY` | Alpha Vantage API key | ✅ |
| `VITE_MAPBOX_TOKEN` | Mapbox access token | ✅ |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key | ✅ |
| `DISCORD_BOT_TOKEN` | Discord bot token | ❌ |
| `SITE_URL` | Site URL for redirects | ✅ |

## 📁 Project Structure

```
src/
├── components/
│   ├── somatech/           # Main application components
│   │   ├── courses/        # LMS integration
│   │   ├── layout/         # Layout components
│   │   └── ui/            # Reusable UI components
│   └── ui/                # Shadcn/ui components
├── pages/                 # Page components
├── services/              # API services
├── types/                 # TypeScript type definitions
├── hooks/                 # Custom React hooks
└── lib/                   # Utility functions

supabase/
├── functions/             # Edge functions
│   ├── create-checkout-session/
│   ├── create-portal-session/
│   └── stripe-webhook/
└── migrations/            # Database migrations
```

## 🚀 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests |

## 🔐 Security

- **Environment Variables**: Never commit `.env` files
- **Row Level Security**: Enabled on all Supabase tables
- **API Keys**: Stored securely in environment variables
- **Authentication**: Supabase Auth with JWT tokens
- **Payments**: PCI-compliant Stripe integration

## 📚 Documentation

- [Architecture Overview](./docs/ARCHITECTURE_OVERVIEW.md)
- [API Documentation](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Contributing Guidelines](./docs/CONTRIBUTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/somatech/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/somatech/discussions)
- **Email**: support@somatech.com

## 🏗️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-tenant architecture
- [ ] API rate limiting
- [ ] Automated testing
- [ ] Performance monitoring

---

**Built with ❤️ by the SomaTech Team**
