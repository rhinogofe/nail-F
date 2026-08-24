import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  auditFeatureInlineCoverage,
  formatCoverageReport,
} from '../src/utils/featureInlineCoverage.js'

const require = createRequire(import.meta.url)
const root = path.resolve(fileURLToPath(import.meta.url), '../..')
const { SHOP_FEATURE_CATALOG } = require(
  path.join(root, '../backend/src/constants/shopFeatureCatalog.js')
)

const result = auditFeatureInlineCoverage(SHOP_FEATURE_CATALOG)
console.log(formatCoverageReport(result))
console.log('\n--- JSON summary ---')
console.log(JSON.stringify(result.summary, null, 2))

if (result.summary.missing > 0 || result.summary.partial > 0) {
  process.exitCode = 1
}
