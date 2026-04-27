import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'purge expired site banner',
  { hours: 24 },
  internal.siteBanner.purgeExpiredSiteBanners,
  {}
)

export default crons
