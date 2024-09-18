'use strict';

import { $inputRule, $command} from '@milkdown/utils';
import { InputRule } from '@milkdown/prose/inputrules';
import { findSelectedNodeOfType } from '@milkdown/prose'
import * as mCore from '@milkdown/core';
import * as mCommonmark from '@milkdown/preset-commonmark';

export const extendedImageSchemaPlugin = mCommonmark.imageSchema.extendSchema((prevSchema) => {
  return (ctx) => {
      return {
          ...prevSchema(ctx),
          attrs: {
              ...prevSchema(ctx).attrs,
              width: { default: '' },
              height: { default: '' },
              link: { default: '' },
          },
          parseDOM: [
              ...prevSchema(ctx).parseDOM,
              {
                  tag: 'img[src]',
                  getAttrs: (dom) => {
                      if (!(dom instanceof HTMLElement)) throw new Error('Expected HTMLElement');
                      return {
                          ...prevSchema(ctx).parseDOM[0].getAttrs(dom),
                          width: dom.getAttribute('width') || '',
                          height: dom.getAttribute('height') || '',
                          link: dom.getAttribute('link') || '',
                      };
                  },
              },
          ],
          parseMarkdown: {
              ...prevSchema(ctx).parseMarkdown,
              runner: (state, node, type) => {
                  console.log('node:', node)
                  const [url, size] = node.url.split(/\s+(.+)$/);
                  const sizeMatch = size && size.match(/^=([\d]+)(%?)x?([\d]*)(%?)$/);
                  var width = '';
                  var height = '';

                  if (sizeMatch) {
                      width = sizeMatch[1];
                      height = sizeMatch[2];
                  }
                  const alt = node.alt;
                  const title = node.title;
                  const link = node.link;
                  state.addNode(type, {
                      src: url,
                      alt,
                      title,
                      width,
                      height,
                      link
                  });
              },
          },
          toMarkdown: {
              ...prevSchema(ctx).toMarkdown,
              runner: (state, node) => {
                  var url = node.attrs.src;               
              
                  if (node.attrs.width || node.attrs.height) {
                      const width = node.attrs.width ? `=${node.attrs.width}` : '';
                      const height = node.attrs.height ? `${node.attrs.height}` : '';
                      url += ` ${height ? `${width}x${height}` : width}`;
                  }              
                  state.addNode('image', undefined, undefined, {
                      title: node.attrs.title,
                      url,
                      alt: node.attrs.alt,
                      link: node.attrs.link,
                      width: node.attrs.width,
                      height: node.attrs.height,
                  });
              },
          },
      };
  };
});

export const extendedUpdateImageCommand = $command('ExtendedUpdateImage', ctx => {
    return function(payload) {
        return function(state, dispatch) {
            var nodeWithPos = findSelectedNodeOfType(state.selection, mCommonmark.imageSchema.type(ctx));
            if (!nodeWithPos) {
                return false;
            }
            const schema = ctx.get(mCore.schemaCtx);
            var node = nodeWithPos.node;
            var pos = nodeWithPos.pos;

            var newAttrs = Object.assign({}, node.attrs);
            var width = payload.width;
            var link = payload.link;
            var linkMark = [];

            if (width && !isNaN(width)) {
                newAttrs.width = width;
            }
            newAttrs.link = link;
            if (link) {
                linkMark = schema.marks.link.create({ href: link });
            }
            dispatch && dispatch(state.tr.setNodeMarkup(pos, undefined, newAttrs, linkMark).scrollIntoView());
            return true;
        };
    };
});

export const updatedInsertImageInputRule = $inputRule(function (ctx) {
    const imagePattern = /!\[(?<alt>[^\]]*)\]\((?<src>[^\s)]+)(?:\s+"(?<title>[^"]*)")?(?:\s+=\s*(?<width>\d+(?:%|x)?)(?:x(?<height>\d*(?:%)?))?)?\)/;

    return new InputRule(imagePattern, (state, match, start, end) => {
        if (!match) return null;

        const { alt, src, title, width, height } = match.groups;

        const attrs = { src, alt, title };
        
        if (width) {
            if (width.endsWith('x')) {
                width = width.slice(0, -1);
            }
            attrs.width = width;
        }
        if (height) attrs.height = height;

        const { tr } = state;
        const nodeType = mCommonmark.imageSchema.type(ctx);

        return tr.replaceWith(start, end, nodeType.create(attrs));
    });
});
