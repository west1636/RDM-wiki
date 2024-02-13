'use strict';
var ko = require('knockout');
var $ = require('jquery');
var $osf = require('js/osfHelpers');
var mathrender = require('js/mathrender');
var md = require('js/markdown').full;
var mdQuick = require('js/markdown').quick;
var mdOld = require('js/markdown').old;
var diffTool = require('js/diffTool');
var _ = require('js/rdmGettext')._;

var THROTTLE = 500;

var yProseMirror = require('y-prosemirror');

var pMarkdown = require('prosemirror-markdown');
var mCtx = require('@milkdown/ctx');
var mCore = require('@milkdown/core');
var mTransformer = require('@milkdown/transformer');
var mCommonmark = require('@milkdown/preset-commonmark');
//var mNord = require('@milkdown/theme-nord');
var mHistory = require('@milkdown/plugin-history');
var mEmoji = require('@milkdown/plugin-emoji');
var mUpload = require('@milkdown/plugin-upload');
var mMath = require('@milkdown/plugin-math');
var mClipboard = require('@milkdown/plugin-clipboard');
var mSlash = require('@milkdown/plugin-slash');
var mGfm = require('@milkdown/preset-gfm');
require('@milkdown/theme-nord/style.css');
require('@milkdown/prose/view/style/prosemirror.css');
require('@milkdown/prose/tables/style/tables.css');
require('katex/dist/katex.min.css')
var mBlock = require('@milkdown/plugin-block');
var mCursor = require('@milkdown/plugin-cursor');
var mListener = require('@milkdown/plugin-listener');
var mPrism = require('@milkdown/plugin-prism');
var mIndent = require('@milkdown/plugin-indent');
var mTooltip = require('@milkdown/plugin-tooltip');
var mUtils = require('@milkdown/utils');
var mCollab = require('@milkdown/plugin-collab');
var yWebsocket = require('y-websocket');
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
const wsPrefix = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
const wsUrl = wsPrefix + window.contextVars.wiki.urls.y_websocket;
var wikiCtx = window.contextVars;
var validImgExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
var imageFolder = 'Wiki images';
var promises = [];
var mEdit;
var altDafaultFlg = false;
var headNum = 1;

function slashPluginView(view) {
  const content = document.createElement('div');
  content.innerHTML = 'testaaaaa';
  const provider = new mSlash.SlashProvider({
    content,
  });

  return {
    update: (updatedView, prevState) => {
      provider.update(updatedView, prevState);
    },
    destroy: () => {
      provider.destroy();
      content.remove();
    }
  }
}

async function createMView(editor, markdown) {
    console.log('----createMView 1------');
    console.log(markdown)
    if (editor && editor.destroy) {
        editor.destroy();
    }
    var viewonly = true
    const editable = () => !viewonly;;
    mView = await mCore.Editor
      .make()
      .config(ctx => {
        ctx.set(mCore.rootCtx, '#mView')
        ctx.set(mCore.defaultValueCtx, markdown);
        ctx.update(mCore.editorViewOptionsCtx, (prev) => ({
            ...prev,
            attributes: { spellcheck: 'false' },
        }))
        ctx.update(mCore.editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable,
        }))
      })
//      .config(mNord.nord)
      .use(mCommonmark.commonmark)
      .use(mEmoji.emoji)
      .use(mUpload.upload)
      .use(mMath.math)
      .use(mClipboard.clipboard)
      .use(mGfm.gfm)
      .use(mBlock.block)
      .use(mCursor.cursor)
      .use(mListener.listener)
      .use(mPrism.prism)
        .use(mIndent.indent)
      .use(mCollab.collab)
      .create()
}


async function createMEditor(editor, vm, template) {
    console.log('----createMEditor 1------');
    console.log(template)
    if (editor && editor.destroy) {
        editor.destroy();
    }
    const enableHtmlFileUploader = false
    const uploader = async (files, schema) => {
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
    const slash = mSlash.slashFactory('my-slash');
    const wsProvider = new yWebsocket.WebsocketProvider(wsUrl, docId, doc);
    mEdit = await mCore.Editor
      .make()
      .config(ctx => {
        ctx.set(mCore.rootCtx, '#mEditor')
        ctx.update(mUpload.uploadConfig.key, (prev) => ({
            ...prev,
            uploader,
            enableHtmlFileUploader,
        }))
        ctx.update(mCore.editorViewOptionsCtx, (prev) => ({
            ...prev,
            attributes: { spellcheck: 'false' },
        }))
        ctx.get(mListener.listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
            console.log('---listener start---')
            const view = ctx.get(mCore.editorViewCtx);
            const state = view.state
            const undoElement = document.getElementById("undoWiki");
            // add event table menu
            var tableWrappers = document.querySelectorAll('.tableWrapper');
            for (let i = 0; i < tableWrappers.length; i++) {
                tableWrappers[i].addEventListener('click', (event) => {
                    document.getElementById("arrowDropDown").style.display = "";
                });
            }
            console.log(prevMarkdown);
            console.log(markdown);
            vm.viewVM.displaySource(markdown);
            // set undo able
            if(state["y-undo$"] !== undefined && (state["y-undo$"].undoManager.undoStack).length !== 0){
                undoElement.disabled = false;
                document.getElementById("msoUndo").style.opacity = 1;
            }
            console.log('---listener end---')
        })
        ctx.update(mCore.editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable,
        }))
        ctx.set(slash.key, {
            view: slashPluginView
        })
      })
//      .config(mNord.nord)
      .use(mCommonmark.commonmark)
      .use(mEmoji.emoji)
      .use(mUpload.upload)
      .use(mMath.math)
      .use(mClipboard.clipboard)
      .use(mGfm.gfm)
      .use(mBlock.block)
      .use(mCursor.cursor)
      .use(mListener.listener)
      .use(slash)
      .use(mPrism.prism)
        .use(mIndent.indent)
      .use(mCollab.collab)
      .create()

    mEdit.action((ctx) => {
        const collabService = ctx.get(mCollab.collabServiceCtx);
        wsProvider.on('sync', isSynced => {
          console.log(isSynced)
        })

        doc.on('update', (update, origin, doc) => {
            console.log('---doc update---')
        })

        wsProvider.on('status', event => {
          console.log(event.status) // logs "connected" or "disconnected"
          vm.status(event.status);
          if (vm.status() !== 'connecting') {
              vm.updateStatus();
              if (vm.status() === 'connected') {
                  console.log('---connected---') 
                  altDafaultFlg = true;
              }
          }
          vm.throttledUpdateStatus();
        })
        wsProvider.on('connection-close', WSClosedEvent => {
          console.log(WSClosedEvent) // logs "connected" or "disconnected"
        })
        wsProvider.on('connection-error', WSClosedEvent => {
          console.log(WSClosedEvent) // logs "connected" or "disconnected"
          vm.status('disconnected');
          vm.updateStatus();
          vm.throttledUpdateStatus();
          if (!altDafaultFlg) {
              mEdit.action(mUtils.insert(template))
              altDafaultFlg = true;
              const parser = ctx.get(mCore.parserCtx)
              const node = parser(template)
              const dummyDoc = yProseMirror.prosemirrorToYDoc(node)
              const dummy = yjs.encodeStateAsUpdate(dummyDoc)
              yjs.applyUpdate(doc, dummy)
              vm.viewVM.displaySource(template);
              console.log('---end alternative apply---') 
          }
        })
        const fullname = window.contextVars.currentUser.fullname;
        wsProvider.awareness.setLocalStateField('user', { name: fullname, color: '#ffb61e'})
        collabService.bindDoc(doc).setAwareness(wsProvider.awareness)
        wsProvider.once('synced', async (isSynced) => {
            if (isSynced) {
                collabService
                .applyTemplate(template, (remoteNode, templateNode) => {
                    console.log('-----applyTemplate start----')
                    console.log(remoteNode)
                    console.log(templateNode)
                    // if no remote node content, apply current to displaySource
                    if (remoteNode.textContent.length === 0) {
                        console.log('-----remote node 0----')
                        vm.viewVM.displaySource(template);
                        return true
                    }
                    if (vm.viewVM.version() === 'preview') {
                        const view = ctx.get(mCore.editorViewCtx);
                        const serializer = ctx.get(mCore.serializerCtx)
                        const toMarkdown = serializer(remoteNode);
                        vm.viewVM.displaySource(toMarkdown);
                    }
                console.log('-----applyTemplate end----')
                })
                .connect();
            }
        });
        console.log('--createMEditor end----')
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
       console.log('---renderMakrdown---');
       console.log(rawContent);
       createMView(mView, rawContent);
    };

    self.displayText =  ko.computed(function() {
        self.allowFullRender();
        var requestURL;
        if (typeof self.version() !== 'undefined') {
            if (self.version() === 'preview') {
//                self.rendered(self.renderMarkdown(self.viewText()));
                console.log('---preview---')
                console.log(mEdit);
                var toMarkdown = '';
                if (mEdit !== undefined) {
                    console.log('---preview tomarkdown---')
                    mEdit.action((ctx) => {
                        const view = ctx.get(mCore.editorViewCtx);
                        const serializer = ctx.get(mCore.serializerCtx)
                        toMarkdown = serializer(view.state.doc)
                    })
                }
                self.displaySource(toMarkdown);
                if (document.getElementById("editWysiwyg").style.display === "none"){
                    document.getElementById("mMenuBar").style.display = "";
                    document.getElementById("mEditorFooter").style.display = "";
                }
                document.getElementById("mEditor").style.display = "";
                document.getElementById("wikiViewRender").style.display = "none";
            } else {
                document.getElementById("mMenuBar").style.display = "none";
                document.getElementById("mEditor").style.display = "none";
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
                        if (resp.rendered_before_update) {
                            // Use old md renderer. Don't mathjaxify
                            self.allowMathjaxification(false);
                            self.rendered(mdOld.render(rawContent));
                            $markdownElement.css('display', 'inherit');

                        } else {
                            // Render raw markdown
                            self.allowMathjaxification(true);
                            self.rendered(self.renderMarkdown(rawContent));
                            $markdownElement.css('display', 'inherit');
                        }
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
    console.log('--CompareWidget--')
    console.log(compareVersion)
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
        console.log(requestURL)
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
        self.throttledStatus(self.status());
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
            mEdit = createMEditor(mEdit, self, rawContent);
            console.log('---after createMEditor---')
            console.log(mEdit)
            console.log('---after createMEditor---')
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
    });

    bodyElement.on('toggleMenu', function(event, menuVisible) {
        self.menuVis(menuVisible);
    });

    self.undoWiki = function() {
        mEdit.action((ctx) => {
            console.log('---undo---')
            var view = ctx.get(mCore.editorViewCtx);
            var state = view.state
            var preUndoOps = state["y-undo$"]
            view.focus()
            yProseMirror.undo(state)
            console.log(state["y-undo$"])
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
            console.log('---redo---')
            const view = ctx.get(mCore.editorViewCtx);
            const state = view.state
            view.focus()
            yProseMirror.redo(state)
            console.log(state["y-undo$"])
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
        var linkHref = document.getElementById("linkHref");
        var linkTitle = document.getElementById("linkTitle");
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            mUtils.callCommand(mCommonmark.toggleLinkCommand.key, {href: linkHref.value, title: linkTitle.value})(ctx)
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

    self.table = function() {
        var cssArrow = document.getElementById("arrowDropDown").style.display;
        console.log('--table---');
        console.log(cssArrow);
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

    document.addEventListener('mousedown', (event) => {
        console.log(event);
        console.log(event.target);
        console.log(event.target.closest('.tableWrapper'));
        console.log(event.target.closest('.table-dropdown-item'));
        console.log(event.target.closest('#tableBtn'));
        if (!(event.target.closest('.tableWrapper')) && !(event.target.closest('#tableBtn'))) {
            document.getElementById("arrowDropDown").style.display = "none";
        }
        if (!(event.target.closest('.table-dropdown-item')) && !(event.target.closest('#tableBtn'))) {
            document.getElementById("tableMenu").style.display = "none";
        }
    });

    document.addEventListener('click', (event) => {
        console.log('---view focus---')
        if (event.target.closest('#mEditor')) {
            mEdit.action((ctx) => {
                const view = ctx.get(mCore.editorViewCtx);
                view.focus()
            })
        }
    });

    self.editMode = function() {
      if(self.canEdit) {
        readonly = false;
        console.log('--editmode--')
        console.log(mEdit)
        console.log('--editmode--')
        self.viewVersion('preview');
        document.getElementById("mMenuBar").style.display = "";
        document.getElementById("editWysiwyg").style.display = "none";
        document.getElementById("mEditorFooter").style.display = "";

        var tableWrappers = document.querySelectorAll('.tableWrapper');
        console.log(tableWrappers);
        for (let i = 0; i < tableWrappers.length; i++) {
            tableWrappers[i].addEventListener('click', (event) => {
            document.getElementById("arrowDropDown").style.display = "";
            });
        }
        mEdit.action((ctx) => {
            const view = ctx.get(mCore.editorViewCtx);
            view.focus();
            const serializer = ctx.get(mCore.serializerCtx)
            const toMarkdown = serializer(view.state.doc)
            self.viewVM.displaySource(toMarkdown);
            console.log(toMarkdown)
        })
      } else {
       // output modal 'can not edit because of your permmission'
      }
    }

    self.closeDialog = function() {
        console.log('aaa')
    }

    self.editModeOff = function() {
        readonly = true;
        document.getElementById("mMenuBar").style.display = "none";
        document.getElementById("mEditorFooter").style.display = "none";
        document.getElementById("editWysiwyg").style.display = "";
    }

    // Command once to get edits, including collaborative editing or for only set preview comparison value.
    self.submitMText = function() {
        var toMarkdown = '';
        mEdit.action((ctx) => {
            console.log('---submitMText---');
            const view = ctx.get(mCore.editorViewCtx);
            const serializer = ctx.get(mCore.serializerCtx)
            toMarkdown = serializer(view.state.doc)
        })
        var pageUrl = window.contextVars.wiki.urls.page;
        $.ajax({
            url:pageUrl,
            type:'POST',
            data: JSON.stringify({markdown: toMarkdown}),
            contentType: 'application/json; charset=utf-8',
        }).done(function (resp) {
            const reloadUrl = (location.href).replace(location.search, '')
            window.location.assign(reloadUrl);
        }).fail(function(xhr) {
            var resp = JSON.parse(xhr.responseText);
            var message = resp.message;
            console.log(message)
        });
    }
}

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

var WikiPage = function(selector, options) {
    var self = this;
    self.options = $.extend({}, defaultOptions, options);

    this.viewModel = new ViewModel(self.options);
    $osf.applyBindings(self.viewModel, selector);
};

module.exports = WikiPage;

