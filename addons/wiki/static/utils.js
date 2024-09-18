'use strict';

function isParent(node) {
    return !!(node && node.children && Array.isArray(node.children));
  }
  
export function isLiteral(node) {
    return !!(node && typeof node.value === 'string');
  }

export function flatMap(ast, fn) {
    return transform(ast, 0, null)[0];

    function transform(node, index, parent) {
      if (isParent(node)) {
        const out = []
        for (var i = 0, n = node.children.length; i < n; i++) {
          const nthChild = node.children[i]
          if (nthChild) {
            const xs = transform(nthChild, i, node)
            if (xs) {
              for (var j = 0, m = xs.length; j < m; j++) {
                const item = xs[j]
                if (item)
                  out.push(item)
              }
            }
          }
        }
        node.children = out
      }
  
      return fn(node, index, parent)
    }
  }
