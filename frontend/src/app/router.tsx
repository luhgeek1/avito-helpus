import { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router'
import { z } from 'zod'
import { eventCategorySchema, eventFormatSchema } from '../api/schemas'
import { Layout } from '../components/layout/Layout'
import { AiPage } from '../pages/AiPage'
import { ArticlePage } from '../pages/ArticlePage'
import { BenefitsPage } from '../pages/BenefitsPage'
import { EventsPage } from '../pages/EventsPage'
import { FeedPage } from '../pages/FeedPage'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ProfilePage } from '../pages/ProfilePage'
import { SearchPage } from '../pages/SearchPage'
import { ServicePage } from '../pages/ServicePage'
import { ServicesPage } from '../pages/ServicesPage'

export type RouterContext = { queryClient: QueryClient }

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Layout,
  notFoundComponent: NotFoundPage,
})

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage })

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => <ProfilePage personId="me" />,
})

const personRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/people/$personId',
  component: function PersonRoute() {
    const { personId } = personRoute.useParams()
    return <ProfilePage personId={personId} />
  },
})

export const eventsSearchSchema = z.object({
  category: eventCategorySchema.optional().catch(undefined),
  format: eventFormatSchema.optional().catch(undefined),
  period: z.enum(['today', 'week', 'month']).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
})

export const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  validateSearch: (search) => eventsSearchSchema.parse(search),
  component: EventsPage,
})

export const feedSearchSchema = z.object({ channel: z.string().optional().catch(undefined) })

export const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feed',
  validateSearch: (search) => feedSearchSchema.parse(search),
  component: FeedPage,
})

export const articleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feed/$postId',
  component: ArticlePage,
})

export const benefitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/benefits/$categoryId',
  component: BenefitsPage,
})

const servicesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/services', component: ServicesPage })

export const serviceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services/$serviceId',
  component: ServicePage,
})

export const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search) => z.object({ q: z.string().catch('') }).parse(search),
  component: SearchPage,
})

const aiRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ai', component: AiPage })

export const routeTree = rootRoute.addChildren([
  indexRoute,
  profileRoute,
  personRoute,
  eventsRoute,
  feedRoute,
  articleRoute,
  benefitsRoute,
  servicesRoute,
  serviceRoute,
  searchRoute,
  aiRoute,
])

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
