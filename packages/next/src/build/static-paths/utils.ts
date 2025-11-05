import type { LoaderTree } from '../../server/lib/app-dir-module'
import type { AppPageRouteModule } from '../../server/route-modules/app-page/module.compiled'
import type { AppRouteRouteModule } from '../../server/route-modules/app-route/module.compiled'
import { isAppPageRouteModule } from '../../server/route-modules/checks'
import type { DynamicParamTypes } from '../../shared/lib/app-router-types'
import {
  parseAppRouteSegment,
  type NormalizedAppRoute,
  type NormalizedAppRouteSegment,
} from '../../shared/lib/router/routes/app'
import { parseLoaderTree } from '../../shared/lib/router/utils/parse-loader-tree'
import type { AppSegment } from '../segment-config/app/app-segments'
import type { FallbackRouteParam } from './types'

/**
 * Encodes a parameter value using the provided encoder.
 *
 * @param value - The value to encode.
 * @param encoder - The encoder to use.
 * @returns The encoded value.
 */
export function encodeParam(
  value: string | string[],
  encoder: (value: string) => string
) {
  let replaceValue: string
  if (Array.isArray(value)) {
    replaceValue = value.map(encoder).join('/')
  } else {
    replaceValue = encoder(value)
  }

  return replaceValue
}

/**
 * Normalizes a pathname to a consistent format.
 *
 * @param pathname - The pathname to normalize.
 * @returns The normalized pathname.
 */
export function normalizePathname(pathname: string) {
  return pathname.replace(/\\/g, '/').replace(/(?!^)\/$/, '')
}

/**
 * Creates a fallback route param.
 *
 * @param paramName - The name of the param.
 * @param paramType - The type of the param.
 * @returns The fallback route param.
 */
export function createFallbackRouteParam(
  paramName: string,
  paramType: DynamicParamTypes
): FallbackRouteParam {
  return { paramName, paramType }
}

/**
 * Validates that the static segments in currentPath match the corresponding
 * segments in targetSegments. This ensures we only extract dynamic parameters
 * that are part of the target pathname structure.
 *
 * Segments are compared literally - interception markers like "(.)photo" are
 * part of the pathname and must match exactly.
 *
 * @example
 * // Matching paths
 * currentPath: ['blog', '(.)photo']
 * targetSegments: ['blog', '(.)photo', '[id]']
 * → Returns true (both static segments match exactly)
 *
 * @example
 * // Non-matching paths
 * currentPath: ['blog', '(.)photo']
 * targetSegments: ['blog', 'photo', '[id]']
 * → Returns false (segments don't match - marker is part of pathname)
 *
 * @param currentPath - The accumulated path segments from the loader tree
 * @param targetSegments - The target pathname split into segments
 * @returns true if all static segments match, false otherwise
 */
function validatePrefixMatch(
  currentPath: NormalizedAppRouteSegment[],
  route: NormalizedAppRoute
): boolean {
  for (let i = 0; i < currentPath.length; i++) {
    const pathSegment = currentPath[i]
    const targetPathSegment = route.segments[i]

    // Both segments must be either dynamic or match exactly (literal comparison)
    if (
      pathSegment.type === 'static' &&
      targetPathSegment.type === 'static' &&
      pathSegment.name !== targetPathSegment.name
    ) {
      // Both are static segments but don't match literally
      return false
    }

    if (
      pathSegment.type === 'dynamic' &&
      targetPathSegment.type === 'dynamic' &&
      pathSegment.param.param !== targetPathSegment.param.param
    ) {
      // Both are dynamic segments but don't match exactly
      return false
    }
  }

  return true
}

/**
 * Extracts segments that contribute to the pathname by traversing the loader tree
 * based on the route module type.
 *
 * @param routeModule - The app route module (page or route handler)
 * @param segments - Array of AppSegment objects collected from the route
 * @param page - The target pathname to match against, INCLUDING interception
 *               markers (e.g., "/blog/[slug]", "/(.)photo/[id]")
 * @returns Array of segments with param info that contribute to the pathname
 */
export function extractPathnameRouteParamSegments(
  routeModule: AppRouteRouteModule | AppPageRouteModule,
  segments: readonly Readonly<AppSegment>[],
  route: NormalizedAppRoute
): Array<{
  readonly name: string
  readonly paramName: string
  readonly paramType: DynamicParamTypes
}> {
  // For AppPageRouteModule, use the loaderTree traversal approach
  if (isAppPageRouteModule(routeModule)) {
    return extractPathnameRouteParamSegmentsFromLoaderTree(
      routeModule.userland.loaderTree,
      route
    )
  }

  return extractPathnameRouteParamSegmentsFromSegments(segments)
}

export function extractPathnameRouteParamSegmentsFromSegments(
  segments: readonly Readonly<AppSegment>[]
): Array<{
  readonly name: string
  readonly paramName: string
  readonly paramType: DynamicParamTypes
}> {
  // TODO: should we consider what values are already present in the page?

  // For AppRouteRouteModule, filter the segments array to get the route params
  // that contribute to the pathname.
  const result: Array<{
    readonly name: string
    readonly paramName: string
    readonly paramType: DynamicParamTypes
  }> = []

  for (const segment of segments) {
    // Skip segments without param info.
    if (!segment.paramName || !segment.paramType) continue

    // Collect all the route param keys that contribute to the pathname.
    result.push({
      name: segment.name,
      paramName: segment.paramName,
      paramType: segment.paramType,
    })
  }

  return result
}

/**
 * Extracts pathname route param segments from a loader tree.
 *
 * @param loaderTree - The loader tree structure containing route hierarchy
 * @param page - The target pathname to match against
 * @returns Array of segments with param info that contribute to the pathname
 */
export function extractPathnameRouteParamSegmentsFromLoaderTree(
  loaderTree: LoaderTree,
  route: NormalizedAppRoute
): Array<{
  readonly name: string
  readonly paramName: string
  readonly paramType: DynamicParamTypes
}> {
  const result: Array<{
    readonly name: string
    readonly paramName: string
    readonly paramType: DynamicParamTypes
  }> = []

  // BFS traversal with depth and path tracking
  const queue: Array<{
    tree: LoaderTree
    depth: number
    currentPath: NormalizedAppRouteSegment[]
  }> = [{ tree: loaderTree, depth: 0, currentPath: [] }]

  while (queue.length > 0) {
    const { tree, depth, currentPath } = queue.shift()!
    const { segment, parallelRoutes } = parseLoaderTree(tree)

    // Build the path for the current node
    let updatedPath = currentPath
    let nextDepth = depth

    const appSegment = parseAppRouteSegment(segment)

    // Only add to path if it's a real segment that appears in the URL
    // Route groups and parallel markers don't contribute to URL pathname
    if (
      appSegment &&
      appSegment.type !== 'route-group' &&
      appSegment.type !== 'parallel-route'
    ) {
      updatedPath = [...currentPath, appSegment]
      nextDepth = depth + 1
    }

    // Check if this segment has a param and matches the target pathname at this depth
    if (appSegment?.type === 'dynamic') {
      const { param: paramName, type: paramType } = appSegment.param

      // Note: paramType already includes -intercepted- suffix if the segment itself
      // has an interception marker (e.g., "(.)[id]" → "dynamic-intercepted-(.)")
      // This is handled by getSegmentParam, not here.

      // Check if this segment is at the correct depth in the target pathname
      // A segment matches if:
      // 1. There's a dynamic segment at this depth in the pathname
      // 2. The parameter names match (e.g., [id] matches [id], not [category])
      // 3. The static segments leading up to this point match (prefix check)
      if (depth < route.segments.length) {
        const targetSegment = route.segments[depth]

        // Match if the target pathname has a dynamic segment at this depth
        if (targetSegment.type === 'dynamic') {
          // Check that parameter names match exactly
          // This prevents [category] from matching against /[id]
          if (paramName !== targetSegment.param.param) {
            continue // Different param names, skip this segment
          }

          // Validate that the path leading up to this dynamic segment matches
          // the target pathname. This prevents false matches like extracting
          // [slug] from "/news/[slug]" when the tree has "/blog/[slug]"
          if (validatePrefixMatch(currentPath, route)) {
            result.push({
              name: segment,
              paramName,
              paramType,
            })
          }
        }
      }
    }

    // Continue traversing all parallel routes to find matching segments
    for (const parallelRoute of Object.values(parallelRoutes)) {
      queue.push({
        tree: parallelRoute,
        depth: nextDepth,
        currentPath: updatedPath,
      })
    }
  }

  return result
}
