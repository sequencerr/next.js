import { parseAppRoute } from '../../shared/lib/router/routes/app'
import { extractPathnameRouteParamSegmentsFromLoaderTree } from './utils'

describe('extractPathnameRouteParamSegmentsFromLoaderTree', () => {
  // Helper to create LoaderTree structures for testing
  type TestLoaderTree = [
    segment: string,
    parallelRoutes: { [key: string]: TestLoaderTree },
    modules: Record<string, unknown>,
  ]

  function createLoaderTree(
    segment: string,
    parallelRoutes: { [key: string]: TestLoaderTree } = {},
    children?: TestLoaderTree
  ): TestLoaderTree {
    const routes = children ? { ...parallelRoutes, children } : parallelRoutes
    return [segment, routes, {}]
  }

  describe('Regular Routes (children segments)', () => {
    it('should extract single dynamic segment from children route', () => {
      // Tree: /[slug]
      const loaderTree = createLoaderTree('', {}, createLoaderTree('[slug]'))
      const route = parseAppRoute('/[slug]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[slug]', paramName: 'slug', paramType: 'dynamic' },
      ])
    })

    it('should extract multiple nested dynamic segments', () => {
      // Tree: /[category]/[slug]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('[category]', {}, createLoaderTree('[slug]'))
      )
      const route = parseAppRoute('/[category]/[slug]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[category]', paramName: 'category', paramType: 'dynamic' },
        { name: '[slug]', paramName: 'slug', paramType: 'dynamic' },
      ])
    })

    it('should extract catchall segment', () => {
      // Tree: /[...slug]
      const loaderTree = createLoaderTree('', {}, createLoaderTree('[...slug]'))
      const route = parseAppRoute('/[...slug]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[...slug]', paramName: 'slug', paramType: 'catchall' },
      ])
    })

    it('should extract optional catchall segment', () => {
      // Tree: /[[...slug]]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('[[...slug]]')
      )
      const route = parseAppRoute('/[[...slug]]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        {
          name: '[[...slug]]',
          paramName: 'slug',
          paramType: 'optional-catchall',
        },
      ])
    })

    it('should extract mixed static and dynamic segments', () => {
      // Tree: /blog/[category]/posts/[slug]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          'blog',
          {},
          createLoaderTree(
            '[category]',
            {},
            createLoaderTree('posts', {}, createLoaderTree('[slug]'))
          )
        )
      )
      const route = parseAppRoute('/blog/[category]/posts/[slug]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[category]', paramName: 'category', paramType: 'dynamic' },
        { name: '[slug]', paramName: 'slug', paramType: 'dynamic' },
      ])
    })

    it('should handle route with no dynamic segments', () => {
      // Tree: /blog/posts
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('blog', {}, createLoaderTree('posts'))
      )
      const route = parseAppRoute('/blog/posts', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([])
    })

    it('should extract only segments matching the target pathname', () => {
      // Tree: /blog/[category] but target pathname is /[category]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('blog', {}, createLoaderTree('[category]'))
      )
      const route = parseAppRoute('/[category]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      // Should not match because depths don't align
      expect(result).toEqual([])
    })
  })

  describe('Route Groups', () => {
    it('should ignore route groups when extracting segments', () => {
      // Tree: /(marketing)/blog/[slug]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          '(marketing)',
          {},
          createLoaderTree('blog', {}, createLoaderTree('[slug]'))
        )
      )
      const route = parseAppRoute('/blog/[slug]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[slug]', paramName: 'slug', paramType: 'dynamic' },
      ])
    })

    it('should ignore nested route groups', () => {
      // Tree: /(group1)/(group2)/[id]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          '(group1)',
          {},
          createLoaderTree('(group2)', {}, createLoaderTree('[id]'))
        )
      )
      const route = parseAppRoute('/[id]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
      ])
    })

    it('should handle route groups mixed with static segments', () => {
      // Tree: /(app)/dashboard/(users)/[userId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          '(app)',
          {},
          createLoaderTree(
            'dashboard',
            {},
            createLoaderTree('(users)', {}, createLoaderTree('[userId]'))
          )
        )
      )
      const route = parseAppRoute('/dashboard/[userId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[userId]', paramName: 'userId', paramType: 'dynamic' },
      ])
    })
  })

  describe('Parallel Routes', () => {
    it('should extract segment from parallel route matching pathname', () => {
      // Tree: / -> @modal/[id]
      const loaderTree = createLoaderTree('', {
        modal: createLoaderTree('[id]'),
      })
      const route = parseAppRoute('/[id]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
      ])
    })

    it('should extract segments from multiple parallel routes at same depth', () => {
      // Tree: / -> @modal/[id] + @sidebar/[category]
      const loaderTree = createLoaderTree('', {
        modal: createLoaderTree('[id]'),
        sidebar: createLoaderTree('[category]'),
      })
      const route = parseAppRoute('/[id]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      // Only [id] matches - [category] has different param name
      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
      ])
    })

    it('should extract segments from both children and parallel routes', () => {
      // Tree: /[lang] -> children + @modal/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('[lang]', {
          modal: createLoaderTree('[photoId]'),
        })
      )
      const route = parseAppRoute('/[lang]/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[lang]', paramName: 'lang', paramType: 'dynamic' },
        { name: '[photoId]', paramName: 'photoId', paramType: 'dynamic' },
      ])
    })

    it('should extract catchall from parallel route', () => {
      // Tree: / -> @sidebar/[...path]
      const loaderTree = createLoaderTree('', {
        sidebar: createLoaderTree('[...path]'),
      })
      const route = parseAppRoute('/[...path]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[...path]', paramName: 'path', paramType: 'catchall' },
      ])
    })

    it('should NOT extract parallel route segments that do not match pathname', () => {
      // Tree: /[id] -> @modal/[photoId] + @sidebar/[category]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('[id]', {
          modal: createLoaderTree('[photoId]'),
          sidebar: createLoaderTree('[category]'),
        })
      )
      const route = parseAppRoute('/[id]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      // Only [id] should match, parallel routes are at depth 1
      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
      ])
    })
  })

  describe('Interception Routes', () => {
    it('should extract segment from (.) same-level interception route', () => {
      // Tree: /(.)photo/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('(.)photo', {}, createLoaderTree('[photoId]'))
      )
      const route = parseAppRoute('/(.)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should extract segment from (..) parent-level interception route', () => {
      // Tree: /gallery/(..)photo/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          'gallery',
          {},
          createLoaderTree('(..)photo', {}, createLoaderTree('[photoId]'))
        )
      )
      const route = parseAppRoute('/gallery/(..)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should extract segment from (...) root-level interception route', () => {
      // Tree: /app/gallery/(...)photo/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          'app',
          {},
          createLoaderTree(
            'gallery',
            {},
            createLoaderTree('(...)photo', {}, createLoaderTree('[photoId]'))
          )
        )
      )
      const route = parseAppRoute('/app/gallery/(...)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should extract segment from (..)(..) grandparent-level interception route', () => {
      // Tree: /a/b/(..)(..)photo/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          'a',
          {},
          createLoaderTree(
            'b',
            {},
            createLoaderTree('(..)(..)photo', {}, createLoaderTree('[photoId]'))
          )
        )
      )
      const route = parseAppRoute('/a/b/(..)(..)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should distinguish interception routes from route groups', () => {
      // Tree: /(marketing)/[slug] vs /(.)photo/[photoId]
      const routeGroupTree = createLoaderTree(
        '',
        {},
        createLoaderTree('(marketing)', {}, createLoaderTree('[slug]'))
      )
      const interceptionTree = createLoaderTree(
        '',
        {},
        createLoaderTree('(.)photo', {}, createLoaderTree('[photoId]'))
      )

      const routeGroupRoute = parseAppRoute('/[slug]', true)
      const interceptionRoute = parseAppRoute('/(.)photo/[photoId]', true)

      const routeGroupResult = extractPathnameRouteParamSegmentsFromLoaderTree(
        routeGroupTree,
        routeGroupRoute
      )
      const interceptionResult =
        extractPathnameRouteParamSegmentsFromLoaderTree(
          interceptionTree,
          interceptionRoute
        )

      // Route group ignored, slug at depth 0
      expect(routeGroupResult).toEqual([
        { name: '[slug]', paramName: 'slug', paramType: 'dynamic' },
      ])

      // Interception route counts, photoId at depth 1
      expect(interceptionResult).toEqual([
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should handle catchall in interception route', () => {
      // Tree: /(.)photo/[...segments]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('(.)photo', {}, createLoaderTree('[...segments]'))
      )
      const route = parseAppRoute('/(.)photo/[...segments]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        {
          name: '[...segments]',
          paramName: 'segments',
          paramType: 'catchall',
        },
      ])
    })

    it('should extract intercepted param when marker is part of the segment itself', () => {
      // Tree: /(.)[photoId] - the interception marker is PART OF the dynamic segment
      // This is the case where -intercepted- types apply (handled by getSegmentParam)
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('(.)[photoId]')
      )
      const route = parseAppRoute('/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        {
          name: '(.)[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic-intercepted-(.)', // NOW it has -intercepted- type
        },
      ])
    })
  })

  describe('Interception Routes in Parallel Routes', () => {
    it('should extract segment from interception route in parallel slot', () => {
      // Tree: @modal/(.)photo/[photoId]
      const loaderTree = createLoaderTree('', {
        modal: createLoaderTree('(.)photo', {}, createLoaderTree('[photoId]')),
      })
      const route = parseAppRoute('/(.)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should extract segments from both children and intercepting parallel route', () => {
      // Tree: /[id] -> children + @modal/(.)photo/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('[id]', {
          modal: createLoaderTree(
            '(.)photo',
            {},
            createLoaderTree('[photoId]')
          ),
        })
      )
      const route = parseAppRoute('/[id]/(.)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should extract from multiple parallel routes with interception', () => {
      // Tree: /[category] -> @modal/(.)photo/[photoId] + @sidebar/(.)filter/[filterId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('[category]', {
          modal: createLoaderTree(
            '(.)photo',
            {},
            createLoaderTree('[photoId]')
          ),
          sidebar: createLoaderTree(
            '(.)filter',
            {},
            createLoaderTree('[filterId]')
          ),
        })
      )
      const route = parseAppRoute('/[category]/(.)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[category]', paramName: 'category', paramType: 'dynamic' },
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should handle (..) interception in parallel route with nested structure', () => {
      // Tree: /gallery/[id] -> @modal/(..)photo/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          'gallery',
          {},
          createLoaderTree('[id]', {
            modal: createLoaderTree(
              '(..)photo',
              {},
              createLoaderTree('[photoId]')
            ),
          })
        )
      )
      const route = parseAppRoute('/gallery/[id]/(..)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should handle (...) root-level interception in parallel route', () => {
      // Tree: /app/gallery/[id] -> @modal/(...)photo/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          'app',
          {},
          createLoaderTree(
            'gallery',
            {},
            createLoaderTree('[id]', {
              modal: createLoaderTree(
                '(...)photo',
                {},
                createLoaderTree('[photoId]')
              ),
            })
          )
        )
      )
      const route = parseAppRoute(
        '/app/gallery/[id]/(...)photo/[photoId]',
        true
      )
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should handle catchall in intercepting parallel route', () => {
      // Tree: /[id] -> @modal/(.)details/[...segments]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('[id]', {
          modal: createLoaderTree(
            '(.)details',
            {},
            createLoaderTree('[...segments]')
          ),
        })
      )
      const route = parseAppRoute('/[id]/(.)details/[...segments]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
        {
          name: '[...segments]',
          paramName: 'segments',
          paramType: 'catchall',
        },
      ])
    })
  })

  describe('Complex Mixed Scenarios', () => {
    it('should handle route groups + parallel routes + interception routes', () => {
      // Tree: /(marketing)/[lang] -> @modal/(.)photo/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          '(marketing)',
          {},
          createLoaderTree('[lang]', {
            modal: createLoaderTree(
              '(.)photo',
              {},
              createLoaderTree('[photoId]')
            ),
          })
        )
      )
      const route = parseAppRoute('/[lang]/(.)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[lang]', paramName: 'lang', paramType: 'dynamic' },
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should handle deeply nested parallel routes with interception', () => {
      // Tree: /[lang]/blog/[category] -> @modal/(.)post/[slug]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          '[lang]',
          {},
          createLoaderTree(
            'blog',
            {},
            createLoaderTree('[category]', {
              modal: createLoaderTree(
                '(.)post',
                {},
                createLoaderTree('[slug]')
              ),
            })
          )
        )
      )
      const route = parseAppRoute(
        '/[lang]/blog/[category]/(.)post/[slug]',
        true
      )
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[lang]', paramName: 'lang', paramType: 'dynamic' },
        { name: '[category]', paramName: 'category', paramType: 'dynamic' },
        {
          name: '[slug]',
          paramName: 'slug',
          paramType: 'dynamic',
        },
      ])
    })

    it('should handle multiple interception routes at different levels', () => {
      // Tree: /[id] -> @modal1/(.)a/[a] + @modal2/(..)b/[b]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('[id]', {
          modal1: createLoaderTree('(.)a', {}, createLoaderTree('[a]')),
          modal2: createLoaderTree('(..)b', {}, createLoaderTree('[b]')),
        })
      )
      const route = parseAppRoute('/[id]/(.)a/[a]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
        {
          name: '[a]',
          paramName: 'a',
          paramType: 'dynamic',
        },
      ])
    })

    it('should extract from actual Next.js photo gallery pattern', () => {
      // Realistic pattern: /photos/[id] with @modal/(.)photo/[photoId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          'photos',
          {},
          createLoaderTree('[id]', {
            modal: createLoaderTree(
              '(.)photo',
              {},
              createLoaderTree('[photoId]')
            ),
          })
        )
      )
      const route = parseAppRoute('/photos/[id]/(.)photo/[photoId]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
        {
          name: '[photoId]',
          paramName: 'photoId',
          paramType: 'dynamic',
        },
      ])
    })

    it('should handle i18n with interception routes', () => {
      // Tree: /[locale]/products/[category] -> @modal/(.)product/[productId]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          '[locale]',
          {},
          createLoaderTree(
            'products',
            {},
            createLoaderTree('[category]', {
              modal: createLoaderTree(
                '(.)product',
                {},
                createLoaderTree('[productId]')
              ),
            })
          )
        )
      )
      const route = parseAppRoute(
        '/[locale]/products/[category]/(.)product/[productId]',
        true
      )
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[locale]', paramName: 'locale', paramType: 'dynamic' },
        { name: '[category]', paramName: 'category', paramType: 'dynamic' },
        {
          name: '[productId]',
          paramName: 'productId',
          paramType: 'dynamic',
        },
      ])
    })
  })

  describe('Edge Cases', () => {
    it('should return empty array for pathname with no dynamic segments', () => {
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('blog', {}, createLoaderTree('posts'))
      )
      const route = parseAppRoute('/blog/posts', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([])
    })

    it('should return empty array when no segments match pathname', () => {
      // Tree has dynamic segments but they don't match the pathname structure
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('api', {}, createLoaderTree('[version]'))
      )
      const route = parseAppRoute('/different/path', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([])
    })

    it('should handle empty segment in tree', () => {
      // Tree: '' -> [id]
      const loaderTree = createLoaderTree('', {}, createLoaderTree('[id]'))
      const route = parseAppRoute('/[id]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
      ])
    })

    it('should match segments by depth and param name', () => {
      // Tree: /[lang]/blog/[slug] but pathname is /[lang]/[slug]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          '[lang]',
          {},
          createLoaderTree('blog', {}, createLoaderTree('[slug]'))
        )
      )
      const route = parseAppRoute('/[lang]/[slug]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      // Should match [lang] at depth 0 but not [slug] (wrong depth)
      expect(result).toEqual([
        { name: '[lang]', paramName: 'lang', paramType: 'dynamic' },
      ])
    })

    it('should handle optional catchall in parallel route', () => {
      // Tree: @sidebar/[[...optional]]
      const loaderTree = createLoaderTree('', {
        sidebar: createLoaderTree('[[...optional]]'),
      })
      const route = parseAppRoute('/[[...optional]]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        {
          name: '[[...optional]]',
          paramName: 'optional',
          paramType: 'optional-catchall',
        },
      ])
    })

    it('should handle multiple route groups in sequence', () => {
      // Tree: /(a)/(b)/(c)/[id]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          '(a)',
          {},
          createLoaderTree(
            '(b)',
            {},
            createLoaderTree('(c)', {}, createLoaderTree('[id]'))
          )
        )
      )
      const route = parseAppRoute('/[id]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[id]', paramName: 'id', paramType: 'dynamic' },
      ])
    })
  })

  describe('Static Segment Matching', () => {
    it('should not extract segments when static segments do not match', () => {
      // Tree: /blog/[slug] but pathname is /news/[slug]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree('blog', {}, createLoaderTree('[slug]'))
      )
      const route = parseAppRoute('/news/[slug]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([])
    })

    it('should match when static segments align correctly', () => {
      // Tree: /api/v1/[endpoint] -> /api/v1/[endpoint]
      const loaderTree = createLoaderTree(
        '',
        {},
        createLoaderTree(
          'api',
          {},
          createLoaderTree('v1', {}, createLoaderTree('[endpoint]'))
        )
      )
      const route = parseAppRoute('/api/v1/[endpoint]', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([
        { name: '[endpoint]', paramName: 'endpoint', paramType: 'dynamic' },
      ])
    })

    it('should handle segments with values already present in the page', () => {
      // Tree: /blog/[slug] but pathname is /blog/my-slug
      const loaderTree = createLoaderTree(
        '',
        {
          sidebar: createLoaderTree('[[...catchAll]]'),
        },
        createLoaderTree('blog', {}, createLoaderTree('[slug]'))
      )
      const route = parseAppRoute('/blog/my-slug', true)
      const result = extractPathnameRouteParamSegmentsFromLoaderTree(
        loaderTree,
        route
      )

      expect(result).toEqual([])
    })
  })
})
