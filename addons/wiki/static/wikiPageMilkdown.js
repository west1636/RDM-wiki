'use strict';
var ko = require('knockout');
var $ = require('jquery');
var $osf = require('js/osfHelpers');
var mdOld = require('js/markdown').old;
var diffTool = require('js/diffTool');
var _ = require('js/rdmGettext')._;
//var mGrdmCommonmark = require('@milkdown/preset-grdm-commonmark');
var THROTTLE = 500;
//var TablePicker = require('create-table-picker');
var yProseMirror = require('y-prosemirror');

//var mCore = require('@milkdown/core');
//var mGrdmmark = require('@milkdown/preset-grdm');
//var mCommonmark = require('@milkdown/preset-commonmark');
//var mNord = require('@milkdown/theme-nord');
import * as mCore from '@milkdown/core';
import { Ctx } from '@milkdown/ctx';
import * as mCommonmark from '@milkdown/preset-commonmark';
import * as mNord from '@milkdown/theme-nord';
import * as mHistory from '@milkdown/plugin-history';
import * as mEmoji from '@milkdown/plugin-emoji';
import * as mUpload from '@milkdown/plugin-upload';
import * as mMath from '@milkdown/plugin-math';
import * as mClipboard from '@milkdown/plugin-clipboard';
import * as mGfm from '@milkdown/preset-gfm';
import * as mBlock from '@milkdown/plugin-block';
//import * as mCursor from '@milkdown/plugin-cursor';
import * as mListener from '@milkdown/plugin-listener';
import * as mPrism from '@milkdown/plugin-prism';
import * as mIndent from '@milkdown/plugin-indent';
import * as mTooltip from '@milkdown/plugin-tooltip';
import * as mUtils from '@milkdown/utils';
import * as mCollab from '@milkdown/plugin-collab';
//var mHistory = require('@milkdown/plugin-history');
//var mEmoji = require('@milkdown/plugin-emoji');
//var mUpload = require('@milkdown/plugin-upload');
//var mMath = require('@milkdown/plugin-math');
//var mClipboard = require('@milkdown/plugin-clipboard');
//var mGfm = require('@milkdown/preset-gfm');
require('@milkdown/theme-nord/style.css');
//require('@milkdown/theme-nord-css');
require('@milkdown/prose/view/style/prosemirror.css');
require('@milkdown/prose/tables/style/tables.css');
require('katex/dist/katex.min.css')
//var mBlock = require('@milkdown/plugin-block');
//var mCursor = require('@milkdown/plugin-cursor');
//var mListener = require('@milkdown/plugin-listener');
//var mPrism = require('@milkdown/plugin-prism');
//var mIndent = require('@milkdown/plugin-indent');
//var mTooltip = require('@milkdown/plugin-tooltip');
//var mUtils = require('@milkdown/utils');
//var mCollab = require('@milkdown/plugin-collab');
//var directive = require('remark-directive').default;
var yWebsocket = require('y-websocket');
var yIndexeddb = require('y-indexeddb');
var yjs = require('yjs');
var currentOutput = '';
var mEdit;
var mView;

var readonly = true;
const editable = () => !readonly;

var currentMd = '';
var element = document.getElementById("mEditor");
const doc = new yjs.Doc();
const docId = window.contextVars.wiki.metadata.docId;
const wikiCtx = window.contextVars;
const wikiId = (wikiCtx.wiki.wikiName === 'home') ? wikiCtx.node.id : window.contextVars.wiki.wikiID;
const wsPrefix = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
const wsUrl = wsPrefix + window.contextVars.wiki.urls.y_websocket;
var validImgExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
var imageFolder = 'Wiki images';
var promises = [];
var mEdit;

import { $inputRule, $command, $markSchema, $remark, $ctx, $nodeSchema } from '@milkdown/utils';

//var $inputRule = require('@milkdown/utils').$inputRule;
//var $command = require('@milkdown/utils').$command;
//var $markSchema = require('@milkdown/utils').$markSchema;
//var $remark = require('@milkdown/utils').$remark;
//var markRule = require('@milkdown/prose').markRule;
//var toggleMark = require('@milkdown/prose/commands').toggleMark;
//var InputRule = require('@milkdown/prose/inputrules').InputRule;
import { markRule } from '@milkdown/prose';
import { toggleMark } from '@milkdown/prose/commands';
import { InputRule } from '@milkdown/prose/inputrules';
import { NodeSelection } from '@milkdown/prose/state';
import { findSelectedNodeOfType } from '@milkdown/prose'

const underlineSchema = $markSchema('underline', function () {
    return {
        parseDOM: [
            { tag: 'u' },
            { style: 'text-decoration', getAttrs: value => value === 'underline' ? {} : false },
        ],
        toDOM: mark => ['u', 0],
        parseMarkdown: {
            match: node => node.type === 'underline',
            runner: (state, node, markType) => {
                state.openMark(markType)
                state.next(node.children)
                state.closeMark(markType)
            }
        },
        toMarkdown: {
            match: mark => mark.type.name === 'underline',
            runner: (state, mark, node) => {
                console.log('---toMarkdown underline---')
                //console.log('state:', state);
                //console.log('mark:', mark);
                //console.log('node:', node);
                state.addNode('text', undefined, `<u>${node.text}</u>`);
                //state.openNode(mark.type.name).next(node.content).closeNode();
                //console.log('schema:', state.schema)
            }
        }
    };
});

const underlineInputRule = $inputRule(function (ctx) {
    return markRule(/<u>(.*?)<\/u>/, underlineSchema.type(ctx));
});

function isParent(node) {
    return !!(node && node.children && Array.isArray(node.children));
  }
  
function isLiteral(node) {
    return !!(node && typeof node.value === 'string');
  }

function flatMap(ast, fn) {
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

const underlinePlugin = function underlinePlugin() {
    function transformer(tree) {
      return flatMap(tree, function(node) {

        if (!isLiteral(node)) return [node];
  
        const value = node.value;
        const output = [];
        const regex = /<u>(.*?)<\/u>/;
        let match;
        let str = value;
        let lastIndex = 0;
  
        while ((match = regex.exec(str))) {
          const { index } = match;
          const underlineText = match[1];
  
          if (index > lastIndex) {
            output.push({
              ...node,
              value: str.slice(lastIndex, index),
              position: {
                start: {
                  line: node.position.start.line,
                  column: node.position.start.column + lastIndex,
                  offset: node.position.start.offset + lastIndex
                },
                end: {
                  line: node.position.start.line,
                  column: node.position.start.column + index,
                  offset: node.position.start.offset + index
                }
              }
            });
          }
  
          if (underlineText) {
            const underlineNode = {
              type: 'underline',
              position: {
                start: {
                  line: node.position.start.line,
                  column: node.position.start.column + index,
                  offset: node.position.start.offset + index
                },
                end: {
                  line: node.position.start.line,
                  column: node.position.start.column + index + match[0].length,
                  offset: node.position.start.offset + index + match[0].length
                }
              },
              children: [
                {
                  type: 'text',
                  value: underlineText,
                  position: {
                    start: {
                      line: node.position.start.line,
                      column: node.position.start.column + index + 3,
                      offset: node.position.start.offset + index + 3
                    },
                    end: {
                      line: node.position.start.line,
                      column: node.position.start.column + index + 3 + underlineText.length,
                      offset: node.position.start.offset + index + 3 + underlineText.length
                    }
                  }
                }
              ]
            };
            output.push(underlineNode);
          }
  
          lastIndex = index + match[0].length;
          regex.lastIndex = lastIndex;
        }

        if (lastIndex < str.length) {
          output.push({
            ...node,
            value: str.slice(lastIndex),
            position: {
              start: {
                line: node.position.start.line,
                column: node.position.start.column + lastIndex,
                offset: node.position.start.offset + lastIndex
              },
              end: {
                line: node.position.end.line,
                column: node.position.end.column,
                offset: node.position.end.offset
              }
            }
          });
        }
  
        return output;
      });
    }
    return transformer;
}

const colortextPlugin = function colortextPlugin() {
    function transformer(tree) {
        return flatMap(tree, function(node) {
            if (!isLiteral(node)) return [node];

            const value = node.value;
            const output = [];
            const regex = /<span style="(.*?)">(.*?)<\/span>/;
            let match;
            let str = value;
            let lastIndex = 0;

            while ((match = regex.exec(str))) {
                const { index } = match;
                const style = match[1];
                const colortext = match[2];
                const color = style.match(/color:\s*([^;]+);?/i)?.[1] || '';

                if (index > lastIndex) {
                    output.push({
                        ...node,
                        value: str.slice(lastIndex, index),
                        position: {
                            start: {
                                line: node.position.start.line,
                                column: node.position.start.column + lastIndex,
                                offset: node.position.start.offset + lastIndex
                            },
                            end: {
                                line: node.position.start.line,
                                column: node.position.start.column + index,
                                offset: node.position.start.offset + index
                            }
                        }
                    });
                }

                if (colortext) {
                    const colortextNode = {
                        type: 'colortext',
                        color: color,
                        position: {
                            start: {
                                line: node.position.start.line,
                                column: node.position.start.column + index,
                                offset: node.position.start.offset + index
                            },
                            end: {
                                line: node.position.start.line,
                                column: node.position.start.column + index + match[0].length,
                                offset: node.position.start.offset + index + match[0].length
                            }
                        },
                        children: [
                            {
                                type: 'text',
                                value: colortext,
                                position: {
                                    start: {
                                        line: node.position.start.line,
                                        column: node.position.start.column + index + match[0].indexOf(colortext),
                                        offset: node.position.start.offset + index + match[0].indexOf(colortext)
                                    },
                                    end: {
                                        line: node.position.start.line,
                                        column: node.position.start.column + index + match[0].indexOf(colortext) + colortext.length,
                                        offset: node.position.start.offset + index + match[0].indexOf(colortext) + colortext.length
                                    }
                                }
                            }
                        ]
                    };
                    output.push(colortextNode);
                }

                lastIndex = index + match[0].length;
                regex.lastIndex = lastIndex;
            }

            if (lastIndex < str.length) {
                output.push({
                    ...node,
                    value: str.slice(lastIndex),
                    position: {
                        start: {
                            line: node.position.start.line,
                            column: node.position.start.column + lastIndex,
                            offset: node.position.start.offset + lastIndex
                        },
                        end: {
                            line: node.position.end.line,
                            column: node.position.end.column,
                            offset: node.position.end.offset
                        }
                    }
                });
            }

            return output;
        });
    }
    return transformer;
}


var remarkUnderline = $remark('remarkUnderline', function () { return underlinePlugin; });
//var remarkUnderline = $remark('remarkUnderline', function() { return [underlinePlugin, underlineToMarkdown]; });
//var remarkDirective = $remark('remarkDirective', function () { return directive; });

var remarkColortext = $remark('remarkColortext', function () { return colortextPlugin; });

const toggleUnderlineCommand = $command('ToggleUnderline', ctx => () => {
    return toggleMark(underlineSchema.type(ctx));
});

const colortextMark = $markSchema('colortext', function () {
    return {
        attrs: {
            color: { default: null },
        },
        toDOM: mark => ['span', { style: `color: ${mark.attrs.color}` }, 0],
        parseMarkdown: {
            match: node => node.type === 'colortext',
            runner: (state, node, markType) => {
                //console.log('---parseMarkdown color---')
                state.openMark(markType, { color: node.color })
                state.next(node.children)
                state.closeMark(markType)
            }
        },
        toMarkdown: {
            match: mark => mark.type.name === 'colortext',
            runner: (state, mark, node) => {
                //console.log('---toMarkdown color---')
                state.addNode('text', undefined, `<span style="color: ${mark.attrs.color}">${node.text}</span>`);
                //state.withMark(mark, 'underline')
            }
        }
    };
});

const colortextInputRule = $inputRule(function (ctx) {
    return markRule(/<span style="color:\s*([^;]+);?">([^<]+)<\/span>/, colortextMark.type(ctx), {
        getAttr: match => ({ color: match[1] }) // 正規表現にマッチした色情報を取得し、attrsとして返す
    });
});

var toggleColortextCommand = $command('ToggleColortext', ctx => {
    return function(color) {
        //('---togglecolortextcommand---')
        if (!color)
            return
        var attrs = { color: color };
        //console.log(color)
        //console.log(attrs)
        return toggleMark(colortextMark.type(ctx), attrs)
    };
});

var toggleMokujimacroCommand = $command('ToggleMokujiMacro', ctx => {
    return function(color) {
        //console.log('---togglemokujimacrocommand---');

    };
});

var extendedUpdateImageCommand = $command('ExtendedUpdateImage', ctx => {
    return function(payload) {
        return function(state, dispatch) {
            var nodeWithPos = findSelectedNodeOfType(state.selection, mCommonmark.imageSchema.type(ctx));
            if (!nodeWithPos) {
                return false;
            }

            const schema = ctx.get(mCore.schemaCtx);
            var node = nodeWithPos.node;
            var pos = nodeWithPos.pos;
            //('---extendedUpdateImageCommand---')
            //console.log(node)
            //console.log(pos)

            var newAttrs = Object.assign({}, node.attrs);
            var src = payload.src;
            var alt = payload.alt;
            var title = payload.title;
            var width = payload.width;
            var height = payload.height; // heightの追加
            var link = payload.link;
            var linkMark;

            if (src !== undefined) {
                newAttrs.src = src;
            }
            if (alt !== undefined) {
                newAttrs.alt = alt;
            }
            if (title !== undefined) {
                newAttrs.title = title;
            }
            if (width !== undefined) {
                newAttrs.width = width;
            }
            if (height !== undefined) { // heightの更新
                newAttrs.height = height;
            }
            if (link !== undefined) {
                newAttrs.link = link;
            }

            if (link) {
                linkMark = schema.marks.link.create({ href: link });
            }
            //console.log(linkMark)
            dispatch && dispatch(state.tr.setNodeMarkup(pos, undefined, newAttrs, linkMark).scrollIntoView());

            return true;
        };
    };
});


// カスタム見出しIDジェネレーターの関数
function customHeadingIdGenerator(node) {
    return node.textContent
        .toLowerCase()              // アルファベットを小文字に変換
        .replace(/[^\p{L}\p{N}]/gu, '') // アルファベット、数字、日本語などの文字を除いた特殊文字を削除
        .replace(/\s+/g, '')        // スペースを削除
        .trim();                    // 余分な空白を除去
}

// 既存のノードスキーマを拡張するプラグインを作成
const extendedImageSchemaPlugin = mCommonmark.imageSchema.extendSchema((prevSchema) => {
    return (ctx) => {
        // カスタムスキーマの定義
        return {
            ...prevSchema(ctx), // 既存のスキーマを基にする
            attrs: {
                ...prevSchema(ctx).attrs,
                width: { default: '' },
                height: { default: '' },  // height 属性を追加
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
                            height: dom.getAttribute('height') || '',  // height 属性を取得
                            link: dom.getAttribute('link') || '',
                        };
                    },
                },
            ],
            parseMarkdown: {
                ...prevSchema(ctx).parseMarkdown,
                runner: (state, node, type) => {
                    const url = node.url;
                    const alt = node.alt;
                    const title = node.title;
                    const width = node.width;
                    const height = node.height;
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
                    var width = node.attrs.width;
                    if (width && width.endsWith('x')) {
                        width = width.slice(0, -1);
                    }                    
                    
                    state.addNode('image', undefined, undefined, {
                        title: node.attrs.title,
                        url: node.attrs.src,
                        alt: node.attrs.alt,
                        link: node.attrs.link,
                        width: width,
                        height: node.attrs.height,
                    });
                },
            },
        };
    };
});

const linkInputRuleCosutom = $inputRule((ctx) => {
    const linkPattern = /(?<!\\|!)\[(?!!\[.*?\]\(.*?\))(.+?(?<!\\)(?:\\\\)*)\]\((.+?)(?:\s+['"](.+?)['"])?\)/;
    return new InputRule(linkPattern, (state, match, start, end) => {
        if (!match) return null;

        var [okay, text, href] = match;
        const { tr } = state;
        const markType = mCommonmark.linkSchema.type(ctx);

        if (!markType) return null;

        if (text === "\ufffc") {
            const node = state.doc.nodeAt(start + 1);
            if (node.type.name === "image") {
                const imageAttrs = {
                    src: node.attrs.src,
                    alt: node.attrs.alt,
                    title: node.attrs.title,
                    link: href,
                    width: node.attrs.width,
                    height: node.attrs.height
                };
                const linkMark = markType.create({ href });
                const imageNode = mCommonmark.imageSchema.type(ctx).create(imageAttrs);
                const imageWithLink = imageNode.mark([linkMark]);
                tr.replaceWith(start, end, imageWithLink);
            }
        } else {
            tr.removeMark(start, end);
            tr.insertText(text, start, end);
            tr.addMark(start, start + text.length, markType.create({ href }));
        }
        return tr;
    });
});

const updatedInsertImageInputRule = $inputRule(function (ctx) {
    const imagePattern = /!\[(?<alt>[^\]]*)\]\((?<src>[^\s)]+)(?:\s+"(?<title>[^"]*)")?(?:\s+=\s*(?<width>\d+(?:%|x)?)(?:x(?<height>\d*(?:%)?))?)?\)/;

    return new InputRule(imagePattern, (state, match, start, end) => {
        if (!match) return null;

        const { alt, src, title, width, height } = match.groups;

        const attrs = { src, alt, title };
        
        if (width) attrs.width = width;
        if (height) attrs.height = height;

        const { tr } = state;
        const nodeType = mCommonmark.imageSchema.type(ctx);

        return tr.replaceWith(start, end, nodeType.create(attrs));
    });
});

async function createMView(editor, markdown) {
    if (editor && editor.destroy) {
        editor.destroy();
    }
    //console.log('createMView::' + markdown)
    var viewonly = true
    const editable = () => !viewonly;
    mView = await mCore.Editor
      .make()
      .config(ctx => {
        ctx.set(mCore.rootCtx, '#mView')
        ctx.set(mCore.defaultValueCtx, markdown);
        ctx.update(mCommonmark.headingIdGenerator.key, () => customHeadingIdGenerator)
        ctx.update(mCore.editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable,
        }))
      })
      .config(mNord.nord)
      .use(mCommonmark.commonmark)
      .use([remarkUnderline, underlineSchema, underlineInputRule, toggleUnderlineCommand])
      .use([remarkColortext, colortextMark, colortextInputRule, toggleColortextCommand])
      .use([linkInputRuleCosutom, updatedInsertImageInputRule])
      //.use(mGrdmmark.commonmark)
      .use(mEmoji.emoji)
      .use(mUpload.upload)
      .use(mMath.math)
      .use(mClipboard.clipboard)
      .use(mGfm.gfm)
      .use(mBlock.block)
      //.use(mCursor.cursor) // <- make not work with custom plugin
      //.use(mGrdmmark.commonmark)
      .use(mListener.listener)
      .use(mPrism.prism)
      .use(mIndent.indent)
      .use(mCollab.collab)
      .use([extendedImageSchemaPlugin/*, updatedInsertImageInputRule*/])
      .create()
}


async function createMEditor(editor, vm, template) {
    if (editor && editor.destroy) {
        editor.destroy();
    }
    const enableHtmlFileUploader = false
    const uploader = async (files, schema) => {
        //console.log('---updaloder---')
        //console.log(schema)
        // You can handle whatever the file can be upload to GRDM.
        var renderInfo = await localFileHandler(files);
        const attachments = [];
        for (let i = 0; i < files.length; i++) {
          var file = files.item(i);
          if (!file) {
            continue;
          }
          attachments.push(file);
        }
        const data = []
        for(let i = 0; i < renderInfo.length; i++){
            data.push({alt: renderInfo[i]['name'], src: renderInfo[i]['url']});
        }
        const ret = data.map(({ alt, src }) => {
            var ext = getExtension(alt);
            if(!(validImgExtensions.includes(ext))){
                var attrs={ title: alt, href: src }
                    return schema.nodes.paragraph.createAndFill({}, schema.text(attrs.title, [schema.marks.link.create(attrs)]))
            }else{
                return schema.nodes.image.createAndFill({ src, alt })
            }
        });
        return ret
    };

// ツールチップのビュー設定
function imageTooltipPluginView(view) {
    const content = document.createElement('div');
    content.id = 'imageTooltip';
    content.style.position = 'absolute';
    content.style.backgroundColor = 'white';
    content.style.border = '1px solid gray';
    content.style.padding = '10px';
    content.style.borderRadius = '5px';
    content.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    content.style.width = '300px';
    content.style.display = 'none'; // 初期状態で非表示

    content.innerHTML = `
        <label style="display: flex; flex-direction: column; margin-bottom: 10px;">
            <span>Size:</span>
            <input id="imageWidth" type="text" style="margin-top: 5px; width: 100%;" value="">
        </label>
        <label style="display: flex; flex-direction: column;">
            <span>Link URL:</span>
            <input id="imageLink" type="text" style="margin-top: 5px; width: 100%;" value="">
        </label>
    `;

    const provider = new mTooltip.TooltipProvider({
        content: content,
        shouldShow: (view) => {
            const { state } = view;
            const { selection } = state;

            // NodeSelection が選択されているとき
            if (!(selection instanceof NodeSelection)) {
                content.style.display = 'none';
                return false;
            }

            const node = state.doc.nodeAt(selection.from);
            if (node?.type.name === 'image') {
                const inputs = content.querySelectorAll('input');
                // サイズとリンクURLを入力フィールドに設定
                inputs[0].value = node.attrs.width || ''; // サイズ
                inputs[1].value = node.attrs.link || ''; // リンクURL
                content.style.display = 'block'; // ツールチップを表示
                return true;
            }

            content.style.display = 'none'; // ツールチップを非表示
            return false;
        },
        position: (view) => {
            const { state } = view;
            const { selection } = state;

            if (!(selection instanceof NodeSelection)) return;

            const node = state.doc.nodeAt(selection.from);
            if (node?.type.name === 'image') {
                const { top, left } = view.coordsAtPos(selection.from);
                content.style.top = `${top + 20}px`; // 画像の下に表示
                content.style.left = `${left}px`;
            }
        }
    });

    return {
        update: (updatedView, prevState) => {
            provider.update(updatedView, prevState);
        },
        destroy: () => {
            provider.destroy();
            content.remove();
        }
    };
}

    const imageTooltip = mTooltip.tooltipFactory('IMAGE'); 
     
    const indexeddbProvider = wikiId ? new yIndexeddb.IndexeddbPersistence(wikiId, doc) : (console.error('Invalid wikiId: it must not be null, undefined, or empty'), null);

    const wsProvider = new yWebsocket.WebsocketProvider(wsUrl, docId, doc);

    mEdit = await mCore.Editor
      .make()
      .config(ctx => {
        //console.log(mCore.rootCtx)
        //console.log(mCommonmark.headingIdGenerator.key)
        ctx.set(mCore.rootCtx, '#mEditor')
        ctx.update(mCommonmark.headingIdGenerator.key, () => customHeadingIdGenerator)
        //ctx.set(mCommonmark.insertImageInputRule, updatedInsertImageInputRule);
        //ctx.update(mCommonmark.insertImageInputRule, () => updatedInsertImageInputRule)
        //ctx.update(mCommonmark.imageSchema.extendSchema, () => customImageSchema);
        ctx.update(mUpload.uploadConfig.key, (prev) => ({
            ...prev,
            uploader,
            enableHtmlFileUploader,
        }))
        const debouncedMarkdownUpdated = $osf.debounce(async (ctx, markdown, prevMarkdown) => {
            //console.log('Markdown updated start');
            const before = new Date();
            //console.log(before.toISOString());    
            //console.log(window.location.href)
            const currentURL = window.location.href;
            const compareWidgetElement = document.getElementById("compareWidget"); 
            if (compareWidgetElement && compareWidgetElement.style.display !== 'none') {
                //console.log("compareWidget is visible");
                vm.viewVM.displaySource(markdown);
            } 
            const view = ctx.get(mCore.editorViewCtx);
            const state = view.state
            const undoElement = document.getElementById("undoWiki");
            // set undo able
            if(state["y-undo$"] !== undefined && (state["y-undo$"].undoManager.undoStack).length !== 0){
                undoElement.disabled = false;
                document.getElementById("msoUndo").style.opacity = 1;
            }
            const after = new Date();
            //console.log(after.toISOString());
            //console.log('Markdown updated end');
        }, 300);
        ctx.get(mListener.listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
            debouncedMarkdownUpdated(ctx, markdown, prevMarkdown);
        });
        ctx.update(mCore.editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable,
        }))
        ctx.set(imageTooltip.key, {
            view: imageTooltipPluginView
        });
      })
      .config(mNord.nord)
      .use(mCommonmark.commonmark)
      .use(extendedUpdateImageCommand)
      .use([remarkUnderline, underlineSchema, underlineInputRule, toggleUnderlineCommand])
      .use([remarkColortext, colortextMark, colortextInputRule, toggleColortextCommand])
      .use([linkInputRuleCosutom, updatedInsertImageInputRule])
      //.use(mGrdmmark.commonmark)
      .use(mEmoji.emoji)
      .use(mUpload.upload)
      .use(mMath.math)
      .use(mClipboard.clipboard)
      .use(mGfm.gfm)
      .use(mBlock.block)
      //.use(mCursor.cursor) // <- make not work with custom plugin
      //.use(mGrdmmark.commonmark)
      .use(mListener.listener)
      .use(mPrism.prism)
      .use(mIndent.indent)
      .use(mCollab.collab)
      .use(imageTooltip)
      .use([extendedImageSchemaPlugin/*, updatedInsertImageInputRule*/])
      .create()

    // プラグインの削除
    //await mEdit.remove(mCommonmark.insertImageInputRule)
    //console.log('---remove mCommonmark.insertImageInputRule---')
    //console.log(mCommonmark)
    //console.log('---remove mCommonmark.insertImageInputRule---')
    //console.log(editor.getPlugins());
    mEdit.action((ctx) => {
        const collabService = ctx.get(mCollab.collabServiceCtx);
        wsProvider.on('sync', isSynced => {
        })

        wsProvider.on('status', event => {
          console.log('---wsProvider event status---')
          console.log(event.status) // logs "connected" or "disconnected"
          console.log('---wsProvider evemt status---')
          console.log('---wsProvider vm status---')
          vm.status(event.status);
          console.log('---wsProvider vm status---')
          console.log(vm.status())
          if (vm.status() !== 'connecting') {
              vm.updateStatus();
          }
          vm.throttledUpdateStatus();
        })
        wsProvider.on('connection-close', WSClosedEvent => {
          //console.log(WSClosedEvent) // logs "connected" or "disconnected"
        })
        wsProvider.on('connection-error', WSClosedEvent => {
          //console.log(WSClosedEvent) // logs "connected" or "disconnected"
          vm.status('disconnected');
          vm.updateStatus();
          vm.throttledUpdateStatus();
        })
        const fullname = window.contextVars.currentUser.fullname;
        wsProvider.awareness.setLocalStateField('user', { name: fullname, color: '#ffb61e'})
        collabService.bindDoc(doc).setAwareness(wsProvider.awareness)
        /*
        if (indexeddbProvider) {
            indexeddbProvider.on('synced', async () => {
                console.log('Content from the database is loaded');
            });
        }
        */
        wsProvider.once('synced', async (isSynced) => {
            if (isSynced) {
                collabService
                .applyTemplate(template, (remoteNode, templateNode) => {
                    // if no remote node content, apply current to displaySource
                    if (remoteNode.textContent.length === 0) {
                        vm.viewVM.displaySource(template);
                        return true
                    } else {
                        const view = ctx.get(mCore.editorViewCtx);
                        const serializer = ctx.get(mCore.serializerCtx)
                        const toMarkdown = serializer(remoteNode);
                        vm.viewVM.displaySource(toMarkdown);
                        return false
                    }
                })
                .connect();
            }
        });
    })

}

function ViewWidget(visible, version, viewText, rendered, contentURL, allowMathjaxification, allowFullRender, editor) {
    var self = this;
    self.version = version;
    self.viewText = viewText; // comes from EditWidget.viewText
    self.rendered = rendered;
    self.visible = visible;
    self.allowMathjaxification = allowMathjaxification;
    self.editor = editor;
    self.allowFullRender = allowFullRender;
    self.renderTimeout = null;
    self.displaySource = ko.observable('');
    self.debouncedAllowFullRender = $osf.debounce(function() {
        self.allowFullRender(true);
    }, THROTTLE);

    self.renderMarkdown = function(rawContent){
       createMView(mView, rawContent);
    };

    self.displayText =  ko.computed(function() {
        self.allowFullRender();
        var requestURL;
        if (typeof self.version() !== 'undefined') {
            if (self.version() === 'preview') {
                var fixedMarkdown = '';
                console.log('---displaytext---')
                if (mEdit !== undefined) {
                    mEdit.action((ctx) => {
                        const view = ctx.get(mCore.editorViewCtx);
                        const serializer = ctx.get(mCore.serializerCtx)
                        const toMarkdown = serializer(view.state.doc)
                        fixedMarkdown = fixCustomSyntax(toMarkdown);
                    })
                }
                self.displaySource(fixedMarkdown);
                if (document.getElementById("editWysiwyg").style.display === "none"){
                    document.getElementById("mMenuBar").style.display = "";
                    document.getElementById("mEditorFooter").style.display = "";
                }
                document.getElementById("mEditor").style.display = "";
                document.getElementById("wikiViewRender").style.display = "none";
            } else {
                document.getElementById("mMenuBar").style.display = "none";
                document.getElementById("mEditor").style.display = "none";
                const milkdownDivs = document.getElementById("mEditor").querySelectorAll('div.milkdown');
                if (milkdownDivs.length > 0) {
                    milkdownDivs[0].remove();  // 最初の要素を削除abc
                    //y-wensocketをdisconnect
                    
                }
                document.getElementById("mEditorFooter").style.display = "none";
                document.getElementById("wikiViewRender").style.display = "";
                if (self.version() === 'current') {
                    requestURL = contentURL;
                } else {
                    requestURL= contentURL + self.version();
                }
                var request = $.ajax({
                    url: requestURL
                });

                request.done(function (resp) {
                    if(self.visible()) {
                        var $markdownElement = $('#wikiViewRender');
                        if (resp.wiki_content){
                            var rawContent = resp.wiki_content
                        } else if(window.contextVars.currentUser.canEdit) {
                            var rawContent = _('*Add important information, links, or images here to describe your project.*');
                        } else {
                            var rawContent = _('*No wiki content.*');
                        }
                        // Render raw markdown
                        self.rendered(self.renderMarkdown(rawContent));
                        self.displaySource(rawContent);
                    }
                });
            }
        } else {
            self.displaySource('');
        }
    });
}

    // currentText comes from ViewWidget.displayText
function CompareWidget(visible, compareVersion, currentText, rendered, contentURL) {
    var self = this;
    self.compareVersion = compareVersion;
    self.currentText = currentText;
    self.rendered = rendered;
    self.visible = visible;
    self.contentURL = contentURL;
    self.compareSource = ko.observable('');

    self.compareText = ko.computed(function() {
        var requestURL;
        if (self.compareVersion() === 'current') {
            requestURL = self.contentURL;
        } else {
            requestURL= self.contentURL + self.compareVersion();
        }
        var request = $.ajax({
            url: requestURL
        });
        request.done(function (resp) {
            var rawText = resp.wiki_content;
            self.compareSource(rawText);
        });

    });

    self.compareOutput = ko.computed(function() {
        var output = diffTool.diff(self.compareSource(), self.currentText());
        self.rendered(output);
        return output;
    }).extend({ notify: 'always' });

}


var defaultOptions = {
    viewVisible: true,
    compareVisible: false,
    menuVisible: true,
    canEdit: true,
    viewVersion: 'current',
    compareVersion: 'previous',
    urls: {
        content: '',
        draft: '',
        page: ''
    },
    metadata: {}
};

function ViewModel(options){
    var self = this;
    // enabled?
    self.viewVis = ko.observable(options.viewVisible);
    self.compareVis = ko.observable(options.compareVisible);
    self.menuVis = ko.observable(options.menuVisible);
    // singleVis : checks if the item visible is the only visible column
    self.singleVis = ko.pureComputed(function(){
        var visible = 0;
        var single;
        if(self.viewVis()){
            visible++;
            single = 'view';
        }
        if(self.compareVis()){
            visible++;
            single = 'compare';
        }
        if(visible === 1){
            return single;
        }
        return false;
    });

    self.pageTitle = $(document).find('title').text();

    self.status = ko.observable('connecting');
    self.throttledStatus = ko.observable(self.status());

    self.compareVersion = ko.observable(options.compareVersion);
    self.viewVersion = ko.observable(options.viewVersion);
    self.draftURL = options.urls.draft;
    self.contentURL = options.urls.content;
    self.pageURL = options.urls.page;
    self.editorMetadata = options.metadata;
    self.canEdit = options.canEdit;

    self.viewText = ko.observable('');
    self.renderedView = ko.observable('');
    self.renderedCompare = ko.observable('');
    self.allowMathjaxification = ko.observable(true);
    self.allowFullRender = ko.observable(true);
    self.viewVersionDisplay = ko.computed(function() {
        var versionString = '';
        if (self.viewVersion() === 'preview') {
            versionString = _('Live preview');
        } else if (self.viewVersion() === 'current'){
            versionString = _('Current version');
        } else if (self.viewVersion() === 'previous'){
            versionString = _('Previous version');
        } else {
            versionString = _('Version ') + self.viewVersion();
        }
        return versionString;
    });

    self.collaborativeStatus = ko.computed(function() {
        console.log(self.viewVersion())
        if (self.viewVersion() === 'preview') {
            document.getElementById("collaborativeStatus").style.display = "";
        } else {
            document.getElementById("collaborativeStatus").style.display = "none";
        }
    });
    // Save initial query params (except for the "mode" query params, which are handled
    // by self.currentURL), so that we can preserve them when we mutate window.history.state
    var initialParams = $osf.urlParams();
    delete initialParams.view;
    delete initialParams.edit;
    delete initialParams.compare;
    delete initialParams.menu;
    self.initialQueryParams = $.param(initialParams);

    self.modalTarget = ko.computed(function() {
        switch(self.throttledStatus()) {
            case 'connected':
                return '#connectedModal';
            case 'connecting':
                return '#connectingModal';
            case 'unsupported':
                return '#unsupportedModal';
            default:
                return '#disconnectedModal';
        }
    });

    self.statusDisplay = ko.computed(function() {
        switch(self.throttledStatus()) {
            case 'connected':
                return 'Live editing mode';
            case 'connecting':
                return 'Attempting to connect';
            default:
                return 'Unavailable: Live editing';
        }
    });

    // Throttle the display when updating status.
    self.updateStatus = function() {
        console.log('---updatestatus---')
        console.log(self.status())
        console.log('---updatestatus---')
        self.throttledStatus(self.status());
        console.log('---update throttledStatus---')
        console.log(self.throttledStatus())
        console.log('---update throttledStatus---')
    };

    self.throttledUpdateStatus = $osf.throttle(self.updateStatus, 4000, {leading: false});


    self.progressBar = ko.computed(function() {
        switch(self.throttledStatus()) {
            case 'connected':
                return {
                    class: 'progress-bar progress-bar-success',
                    style: 'width: 100%'
                };
            case 'connecting':
                return {
                    class: 'progress-bar progress-bar-warning progress-bar-striped active',
                    style: 'width: 100%'
                };
            default:
                return {
                    class: 'progress-bar progress-bar-danger',
                    style: 'width: 100%'
                };
        }
    });

    self.currentURL = ko.computed(function() {
        // Do not change URL for incompatible browsers
        if (typeof window.history.replaceState === 'undefined') {
            return;
        }

        var paramPrefix = '?';
        var url = self.pageURL;
        // Preserve initial query params
        if (self.initialQueryParams) {
            url += paramPrefix + self.initialQueryParams;
            paramPrefix = '&';
        }
        // Default view is special cased
        if (self.viewVis() && self.viewVersion() === 'current' && !self.compareVis() && self.menuVis()) {
            window.history.replaceState({}, '', url);
            return;
        }

        if (self.viewVis()) {
            url += paramPrefix + 'view';
            paramPrefix = '&';
            if  ((self.viewVersion() !== 'current' )) {
                url += '=' + self.viewVersion();
            }
        }
        if (self.compareVis()) {
            url += paramPrefix + 'compare';
            paramPrefix = '&';
            if (self.compareVersion() !== 'previous'){
                url += '=' + self.compareVersion();
            }
        }
        if (self.menuVis()) {
            url += paramPrefix + 'menu';
        }

        window.history.replaceState({}, self.pageTitle, url);
    });

    var request = $.ajax({
        url: self.contentURL
    });
    request.done(function (resp) {
        self.rawContent = resp.wiki_content;
    });

    self.viewVM = new ViewWidget(self.viewVis, self.viewVersion, self.viewText, self.renderedView, self.contentURL, self.allowMathjaxification, self.allowFullRender, self.editor);
    self.compareVM = new CompareWidget(self.compareVis, self.compareVersion, self.viewVM.displaySource, self.renderedCompare, self.contentURL);

    if(self.canEdit) {
        var request = $.ajax({
            url: self.contentURL
        });
        var rawContent = '';
        request.done(function (resp) {
            if (resp.wiki_content){
                rawContent = resp.wiki_content
            }
            if ((self.viewVersion() === 'preview' )) {
                mEdit = createMEditor(mEdit, self, rawContent);
            }
        });
    }
    var bodyElement = $('body');
    bodyElement.on('togglePanel', function (event, panel, display) {
        // Update self.viewVis, or self.compareVis in viewmodel
        self[panel + 'Vis'](display);
        //URL needs to be a computed observable, and this should just update the panel states, which will feed URL
        // Switch view to correct version
        if (panel === 'view') {
            if(!display && self.compareVis()){
                self.viewVersion('preview');
            }
        }
        /*
        if (panel === 'compare') {
            if(display && self.compareVis()){
                self.viewVersion('preview');
                var toMarkdown = '';
                mEdit.action((ctx) => {
                    const view = ctx.get(mCore.editorViewCtx);
                    const serializer = ctx.get(mCore.serializerCtx)
                    toMarkdown = serializer(view.state.doc)
                })
                self.viewVM.displaySource(toMarkdown);
            }
        }
        */
    });

    bodyElement.on('toggleMenu', function(event, menuVisible) {
        self.menuVis(menuVisible);
    });

    self.undoWiki = function() {
        mEdit.action((ctx) => {
            var view = ctx.get(mCore.editorViewCtx);
            var state = view.state
            var preUndoOps = state["y-undo$"]
            view.focus()
            yProseMirror.undo(state)
            if((state["y-undo$"].undoManager.undoStack).length === 0){
                document.getElementById("undoWiki").disabled = true;
                document.getElementById("msoUndo").style.opacity = 0.3;
            }
            document.getElementById("redoWiki").disabled = false;
            document.getElementById("msoRedo").style.opacity = 1;
        })
    }
    self.redoWiki = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            const state = view.state
            view.focus()
            yProseMirror.redo(state)
            if((state["y-undo$"].undoManager.redoStack).length === 0){
                document.getElementById("redoWiki").disabled = true;
                document.getElementById("msoRedo").style.opacity = 0.3;
            }
            document.getElementById("undoWiki").disabled = false;
            document.getElementById("msoUndo").style.opacity = 1;
        })
    }
    self.strong = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            mUtils.callCommand(mCommonmark.toggleStrongCommand.key)(ctx)
        })
    }
    self.link = function() {
        var linkHref = document.getElementById("linkSrc");
        var linkTitle = document.getElementById("linkTitle");
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            const state = view.state;
            const { from, to } = state.selection;
            const markType = ctx.get(mCore.schemaCtx).marks.link;
            
            // 選択範囲にリンクマークが存在するかチェック
            let hasLink = false;
            state.doc.nodesBetween(from, to, node => {
                if (node.marks.some(mark => mark.type === markType)) {
                    hasLink = true;
                }
            });
    
            if (hasLink && linkHref.value === '') {
                // リンクが存在するが、linkHref.value が空の場合、リンクを削除する
                mUtils.callCommand(mCommonmark.toggleLinkCommand.key, {})(ctx);
            } else if (hasLink || linkHref.value !== '') {
                // リンクが既に存在する場合、またはlinkHref.valueが空でない場合、updateLinkCommandを呼び出す
                mUtils.callCommand(mCommonmark.updateLinkCommand.key, {
                    href: linkHref.value,
                    title: linkTitle.value
                })(ctx);
            } else {
                // リンクが存在しない場合、toggleLinkCommandを呼び出す
                mUtils.callCommand(mCommonmark.toggleLinkCommand.key, {
                    href: linkHref.value,
                    title: linkTitle.value
                })(ctx);
            }
            $('.modal').modal('hide');
            linkHref.value = '';
            linkTitle.value = '';
            view.focus()
        })
    }
    self.image = function() {
        var imageSrc = document.getElementById("imageSrc");
        var imageTitle = document.getElementById("imageTitle");
        var imageAlt = document.getElementById("imageAlt");
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            mUtils.callCommand(mCommonmark.insertImageCommand.key, {src: imageSrc.value, title: imageTitle.value, alt: imageAlt.value})(ctx)
            $('.modal').modal('hide');
            imageSrc.value = '';
            imageTitle.value = '';
            imageAlt.value = '';
            view.focus()
        })
    }
    self.changeImage = function() {
        var imageWidth = document.getElementById("imageWidth");
        var imageLink = document.getElementById("imageLink");
        mEdit.action((ctx) => {
            mUtils.callCommand(extendedUpdateImageCommand.key, {width: imageWidth.value, link: imageLink.value})(ctx)
        })
    }
    self.italic = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            mUtils.callCommand(mCommonmark.toggleEmphasisCommand.key)(ctx)
        })
    }
    self.quote = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mCommonmark.wrapInBlockquoteCommand.key)(ctx)
        })
    }
    self.code = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mCommonmark.createCodeBlockCommand.key)(ctx)
        })
    }
    self.listNumbered = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mCommonmark.wrapInOrderedListCommand.key)(ctx)
        })
    }
    self.listBulleted = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mCommonmark.wrapInBulletListCommand.key)(ctx)
        })
    }
    self.head = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            mUtils.callCommand(mCommonmark.wrapInHeadingCommand.key, headNum)(ctx)
            headNum === 6 ? headNum = 1 : headNum =  headNum + 1;
        })
    }

    self.horizontal = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mCommonmark.insertHrCommand.key)(ctx)
        })
    }

    self.underline = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(toggleUnderlineCommand.key)(ctx)
        })
    }

    self.mokujimacro = function() {
        mEdit.action((ctx) => {
            console.log('---mokujimacro1---')
            const view = ctx.get(mCore.editorViewCtx);
            const state = view.state;
            const schema = ctx.get(mCore.schemaCtx);
            const nodes = view.state.doc.content.content;
            console.log(nodes)
            const mokuji = nodes
            .filter(node => node.type.name === 'heading' && node.content && node.content.content[0])
            .map(node => {
                const headingText = node.content.content[0].text;
                const headingId = node.attrs.id;
                const headingLevel = node.attrs.level;
                return { text: headingText, id: headingId, level: headingLevel };
            });
            var pos = state.selection.from;
            var tr = state.tr;

            var currentListItems = [];
            var listStack = [];
            var currentLevel = null;
        
　　　       var mokujiStructure = [];
　　　       var mokujiGroup = {};
            var rootLevel = null;

            mokuji.slice().reverse().forEach(heading => {
                console.log('heading text:', heading.text);
                const attrs = { title: heading.text, href: '#' + heading.id };
                // heading.level に応じたスペースを作成
                const spaces = ' '.repeat((heading.level - 1) * 6);
                const bulletNode = schema.text(spaces + '* ', []); // スペースと「・」を含むテキストノード

                // リンクのテキストノードを作成
                const linkNode = schema.text(heading.text, [schema.marks.link.create(attrs)]);

                // 段落ノードを作成し、「・」とリンク付きテキストを追加
                const paragraphNode = schema.nodes.paragraph.createAndFill({}, [
                    bulletNode,  // スペースと「・」
                    schema.text(' '),  // 「・」とリンクを分けるスペース
                    linkNode  // リンク付きテキスト
                ]);

                //const textNode = schema.text(schema.text('・') + heading.text, [schema.marks.link.create(attrs)]);
                // トランザクションを作成して挿入
                tr.insert(state.selection.from, paragraphNode);
            })
            view.dispatch(tr);
            view.focus()
        })
    }

    self.color = ko.observable('#000000');
    self.colortext = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            var state = view.state;
            var ranges = state.selection.ranges;
            //var colortextMarkExists = ranges.some(r => state.doc.rangeHasMark(r.$from.pos - 1, r.$to.pos, colortextMark.type(ctx)));
            var colortextMarkExists = ranges.some(r => {
                if (r.$from.pos === 1 && r.$to.pos === 1) {
                    return state.doc.rangeHasMark(r.$from.pos, r.$to.pos + 1, colortextMark.type(ctx));
                }
                return state.doc.rangeHasMark(r.$from.pos - 1, r.$to.pos, colortextMark.type(ctx));
            });
            
            if (colortextMarkExists) {
                if (self.color() !== '#000000') {
                    mUtils.callCommand(toggleColortextCommand.key, self.color())(ctx)
                }
            }
            return mUtils.callCommand(toggleColortextCommand.key, self.color())(ctx)
        })
    }

    self.strikethrough = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mGfm.toggleStrikethroughCommand.key)(ctx)
        })
    }

    self.table = function() {
        var cssArrow = document.getElementById("arrowDropDown").style.display;
        if(cssArrow === ''){
            document.getElementById("tableMenu").style.display = "";
            var tableMenu = document.querySelector('#tableMenu');

        } else {
            mEdit.action((ctx) => {
                const view = ctx.get(mCore.editorViewCtx);
                view.focus()
                return mUtils.callCommand(mGfm.insertTableCommand.key)(ctx)
            })
        }
    }

    self.addColumnBef = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mGfm.addColBeforeCommand.key)(ctx)
        })
    }

    self.addColumnAft = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mGfm.addColAfterCommand.key)(ctx)
        })
    }

    self.addRowBef = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mGfm.addRowBeforeCommand.key)(ctx)
        })
    }

    self.addRowAft = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mGfm.addRowAfterCommand.key)(ctx)
        })
    }

    self.deleteSelectedCell = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            return mUtils.callCommand(mGfm.deleteSelectedCellsCommand.key)(ctx)
        })
    }

    self.deleteTable = function() {
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus()
            mUtils.callCommand(mGfm.selectTableCommand.key)(ctx)
            mUtils.callCommand(mGfm.deleteSelectedCellsCommand.key)(ctx)
        })
    }

    var addLink = document.querySelector('#addLink');
    addLink.onclick = self.link.bind(self);
    var addImage = document.querySelector('#addImage');
    addImage.onclick = self.image.bind(self);

    // MutationObserver の設定
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                const imageWidth = document.getElementById("imageWidth");
                const imageLink = document.getElementById("imageLink");

                if (imageWidth && imageLink) {
                    imageWidth.addEventListener('blur', self.changeImage.bind(self));
                    imageLink.addEventListener('blur', self.changeImage.bind(self));
                }
            }
        });
    });

    // 監視するターゲット要素を取得（通常は document.body など）
    const targetNode = document.body;
    // 監視オプションを設定
    const config = { childList: true, subtree: true };

    // 監視を開始
    observer.observe(targetNode, config);

    document.addEventListener('mousedown', (event) => {
        if (!(event.target.closest('.tableWrapper')) && !(event.target.closest('#tableBtn'))) {
            document.getElementById("arrowDropDown").style.display = "none";
        }
        if (!(event.target.closest('.table-dropdown-item')) && !(event.target.closest('#tableBtn'))) {
            document.getElementById("tableMenu").style.display = "none";
        }
    });

    document.addEventListener('click', (event) => {
        if (event.target.closest('#mEditor')) {
            mEdit.action((ctx) => {
                const view = ctx.get(mCore.editorViewCtx);
                view.focus()
            })
        }
        if (event.target.closest('.tableWrapper')) {
            document.getElementById("arrowDropDown").style.display = "";
        }
    });

    self.editMode = function() {
      if(self.canEdit) {
        readonly = false;
        document.getElementById("mMenuBar").style.display = "";
        document.getElementById("editWysiwyg").style.display = "none";
        document.getElementById("mEditorFooter").style.display = "";
        //mEdit.action((ctx) => {
        //    const view = ctx.get(mCore.editorViewCtx);
        //    view.focus();
        //})
        const milkdownDivs = document.getElementById("mEditor").querySelectorAll('div.milkdown');
        if (milkdownDivs.length === 0) {
            var request = $.ajax({
                url: self.contentURL
            });
            var rawContent = '';
            request.done(function (resp) {
                if (resp.wiki_content){
                    rawContent = resp.wiki_content
                }
                mEdit = createMEditor(mEdit, self, rawContent);
            });
        }
        self.viewVersion('preview');
      } else {
       // output modal 'can not edit because of your permmission'
      }
    }

    self.editModeOff = function() {
        readonly = true;
        document.getElementById("mMenuBar").style.display = "none";
        document.getElementById("mEditorFooter").style.display = "none";
        document.getElementById("editWysiwyg").style.display = "";
    }

    // Command once to get edits, including collaborative editing or for only set preview comparison value.
    self.submitMText = function() {
        var fixedMarkdown = '';
        mEdit.action((ctx) => {
            console.log('---submit markdown---')
            const view = ctx.get(mCore.editorViewCtx);
            const serializer = ctx.get(mCore.serializerCtx)
            console.log(view.state.doc)
            var toMarkdown = serializer(view.state.doc)
            console.log(toMarkdown)
            //fix
            fixedMarkdown = fixCustomSyntax(toMarkdown);
            console.log('---submit markdown---')
        })
        var pageUrl = window.contextVars.wiki.urls.page;
        $.ajax({
            url:pageUrl,
            type:'POST',
            data: JSON.stringify({markdown: fixedMarkdown}),
            contentType: 'application/json; charset=utf-8',
        }).done(function (resp) {
            const reloadUrl = (location.href).replace(location.search, '')
            window.location.assign(reloadUrl);
        }).fail(function(xhr) {
            var resp = JSON.parse(xhr.responseText);
            var message = resp.message;
        });
    }
}

function fixCustomSyntax(toMarkdown) {
    //fix underline && colortext
    var replacedMarkdown = toMarkdown.replace(/\\<u>(.*?)\\<\/u>\\<span style="color: ([^"]+)">(.*?)\\<\/span>(\1)/g, '\\<u>\\<span style="color: $2">$1\\</span>\\</u>');
    replacedMarkdown = replacedMarkdown.replace(/\\<span style="color: ([^"]+)">(.*?)\\<\/span>\\<u>(.*?)\\<\/u>\\(\1)/g, '\\<u>\\<span style="color: $2">$1\\</span>\\</u>');
    //fix underline
    replacedMarkdown = replacedMarkdown.replace(/\\<u>(.*?)\\<\/u>(\1)/g, '\\<u>$1\\</u>');
    //fix colortext
    replacedMarkdown = replacedMarkdown.replace(/\\<span style="color: ([^"]+)">(.*?)\\<\/span>\2/g, '\\<span style="color: $1">$2\\</span>');
    return replacedMarkdown;
};


/**
 * If the 'Wiki images' folder does not exist for the current node, createFolder generates the request to create it
 */
function createFolder() {
    return $.ajax({
        url: wikiCtx.waterbutlerURL + 'v1/resources/' + wikiCtx.node.id + '/providers/osfstorage/?name=' + encodeURI(imageFolder) + '&kind=folder',
        type: 'PUT',
        beforeSend: $osf.setXHRAuthorization,
    });
};

/**
 * Checks to see whether there is already a 'Wiki images' folder for the current node
 *
 * If the folder doesn't exist, it attempts to create the folder
 *
 * @return {*} The folder's path attribute if it exists/was created
 */
function getOrCreateWikiImagesFolder() {
    var folderUrl = wikiCtx.apiV2Prefix + 'nodes/' + wikiCtx.node.id + '/files/osfstorage/?filter[kind]=folder&fields[file]=name,path&filter[name]=' + encodeURI(imageFolder);
    return $.ajax({
        url: folderUrl,
        type: 'GET',
        beforeSend: $osf.setXHRAuthorization,
        dataType: 'json'
    }).then(function(response) {
        if (response.data.length > 0) {
            for (var i = 0, folder; folder = response.data[i]; i++) {
                var name = folder.attributes.name;
                if (name === imageFolder) {
                    return folder.attributes.path;
                }
            }
        }
        if (response.data.length === 0) {
            return createFolder().then(function(response) {
                return response.data.attributes.path;
            });
        }
    });
};

async function uplaodDnDFiles(files, path, fileNames) {
	var info = {};
    var infos = [];
    var ext;
    var name;
    var fileBaseUrl = (window.contextVars.wiki.urls.base).replace('wiki', 'files');
    if (path) {
        $.each(files, function (i, file) {
            var newName = null;
            if (fileNames.indexOf(file.name) !== -1) {
                newName = autoIncrementFileName(file.name, fileNames);
            }
            name = newName ? newName : file.name;
            var waterbutlerURL = wikiCtx.waterbutlerURL + 'v1/resources/' + wikiCtx.node.id + '/providers/osfstorage' + encodeURI(path) + '?name=' + encodeURIComponent(name) + '&type=file';
            $osf.trackClick('wiki', 'dropped-image', wikiCtx.node.id);
            promises.push(
                $.ajax({
                    url: waterbutlerURL,
                    type: 'PUT',
                    processData: false,
                    contentType: false,
                    beforeSend: $osf.setXHRAuthorization,
                    data: file,
                }).done(function (response) {
                    var extUploaded = getExtension(response.data.attributes.name);
                    var ext = getExtension(file.name);
                    if(validImgExtensions.includes(ext)){
                        info = {name: response.data.attributes.name, path: response.data.attributes.path, url: response.data.links.download + '?mode=render'}
                        infos.push(info)
                    }else {
                        var waterbutlerURL = wikiCtx.waterbutlerURL + 'v1/resources/' + wikiCtx.node.id + '/providers/osfstorage' + '/files' + response.data.attributes.path;
                        info = {name: response.data.attributes.name, path: response.data.attributes.path, url: fileBaseUrl}
                        infos.push(info)
                    }
                }).fail(function (response) {
                    notUploaded(response, false);
                })
            );
        });
        return $.when.apply(null, promises).then(function () {
            return infos;
        });
    } else {
        notUploaded(null, multiple);
    }
};

async function getFileUrl(infos) {
    if (infos.length !== 0) {
        $.each(infos, function (i, info) {
            var fileUrl = wikiCtx.apiV2Prefix + 'files' + info.path
            promises.push(
                $.ajax({
                    url: fileUrl,
                    type: 'GET',
                    beforeSend: $osf.setXHRAuthorization,
                    dataType: 'json'
                }).done(function (response) {
                    var ext = getExtension(info.name);
                    if(!(validImgExtensions.includes(ext))){
                        info.url = response.data.links.html
                    }
                }).fail(function (response) {
                    notUploaded(response, false);
                })
            );
        });
        return $.when.apply(null, promises).then(function () {
            return infos;
        });
    } else {
        notUploaded(null, multiple);
    }
};

function autoIncrementFileName(name, nameList) {
    var num = 1;
    var newName;
    var ext = getExtension(name);
    var baseName = name.replace('.' + ext, '');

    rename:
    while (true) {
        for (var i = 0; i < nameList.length; i++) {
            newName = baseName + '(' + num + ').' + ext;
            if (nameList[i] === newName) {
                num += 1;
                newName = baseName + '(' + num + ').' + ext;
                continue rename;
            }
        }
        break;
    }
    return newName;
};

function getExtension(filename) {
    return /(?:\.([^.]+))?$/.exec(filename)[1];
};

async function localFileHandler(files) {
    var multiple = files.length > 1;
    var fileNames = [];
    var path;
    var response;
    var info;
    var renderInfo;
    path = await getOrCreateWikiImagesFolder().fail(function(response) {
        notUploaded(response, multiple);
    })
    fileNames = await $.ajax({
    // Check to makes sure we don't overwrite a file with the same name.
        url: wikiCtx.waterbutlerURL + 'v1/resources/' + wikiCtx.node.id + '/providers/osfstorage' + encodeURI(path) + '?meta=',
        beforeSend: $osf.setXHRAuthorization,
    }).then(function(response) {
        return response.data.map(function(file) {
            return file.attributes.name;
        });
    }).fail(function (response) {
        notUploaded(response, false);
    });

    info = await uplaodDnDFiles(files, path, fileNames);
    renderInfo = await getFileUrl(info);
    return renderInfo
}

function notUploaded(response, multiple) {
    var files = multiple ? 'Files' : 'File';
    if (response.status === 403) {
        $osf.growl('Error', 'File not uploaded. You do not have permission to upload files to' +
            ' this project.', 'danger');
    } else {
        $osf.growl('Error', files + ' not uploaded. Please refresh the page and try ' +
            'again or contact <a href="mailto: support@cos.io">support@cos.io</a> ' +
            'if the problem persists.', 'danger');
    }
};

var WikiPageMilkdown = function(selector, options) {
    var self = this;
    self.options = $.extend({}, defaultOptions, options);

    this.viewModel = new ViewModel(self.options);
    $osf.applyBindings(self.viewModel, selector);
    // Set up the event listener for the dropdown
    $('#viewVersionSelect').change(function() {
        if ($(this).val() === 'preview') {
            var request = $.ajax({
                url: self.viewModel.contentURL
            });
            var rawContent = '';
            request.done(function (resp) {
                if (resp.wiki_content){
                    rawContent = resp.wiki_content
                }
                mEdit = createMEditor(mEdit, self.viewModel, rawContent);
            });
        }
    });
};

export default WikiPageMilkdown;

