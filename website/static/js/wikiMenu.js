'use strict';
var ko = require('knockout');
require('knockout-sortable');
var m = require('mithril');
var iconmap = require('js/iconmap');
var Treebeard = require('treebeard');
var $osf = require('js/osfHelpers');

var _ = require('js/rdmGettext')._;

require('../css/fangorn.css');

function resolveToggle(item) {
    var toggleMinus = m('i.fa.fa-minus', ' ');
    var togglePlus = m('i.fa.fa-plus', ' ');

    if (item.children.length > 0) {
        if (item.open) {
            return toggleMinus;
        }
        return togglePlus;
    }
    item.open = true;
    return '';
}

function resolveIcon(item) {
    var icons = iconmap.projectComponentIcons;
    function returnView(category) {
        return m('span', { 'class' : icons[category]});
    }
    if (item.data.kind === 'component' && item.parent().data.title === 'Component Wiki Pages') {
        if(item.data.pointer) {
            return m('i.fa.fa-link', '');
        }
        return returnView(item.data.category);
    }
    if (item.data.type === 'heading') {
        if (item.open) {
            return m('i.fa.fa-folder-open', ' ');
        }
        return m('i.fa.fa-folder', ' ');
    }
    return m('i.fa.fa-file-o', ' ');
}

function WikiMenu(data, wikiID, canEdit) {

    //  Treebeard version
    var tbOptions = {
        rowHeight : 35,         // user can override or get from .tb-row height
        divID: 'grid',
        filesData: data,
        paginate : false,       // Whether the applet starts with pagination or not.
        paginateToggle : false, // Show the buttons that allow users to switch between scroll and paginate.
        uploads : false,         // Turns dropzone on/off.
        hideColumnTitles: true,
        resolveIcon : resolveIcon,
        resolveToggle : resolveToggle,
        columnTitles: function () {
            return[{
                title: _('Name'),
                width: '100%'
            }];
        },
        ondataload: function() {
            var tb = this;  // jshint ignore: line
            for (var i = 0; i < tb.treeData.children.length; i++) {
                var parent = tb.treeData.children[i];
                if (parent.data.title === 'Project Wiki Pages') {
                    tb.updateFolder(null, parent);
                }
            }
        },
        resolveRows : function (item){
            var tb = this;
            var columns = [];
            if(item.data.type === 'heading') {
                columns.push({
                    folderIcons: true,
                    custom: function() {
                        return m('b', _(item.data.title));
                    }
                });
            } else {
                if(item.data.page.id === wikiID) {
                    item.css = 'fangorn-selected';
                    tb.multiselected([item]);
                }
                columns.push({
                    folderIcons: true,
                    custom: function() {
                        return m('a.fg-file-links', {href: item.data.page.url}, _(item.data.page.name));
                    }
                });
            }
            return columns;
        },
        hScroll: 1,    // to set auto.
        showFilter : false,     // Gives the option to filter by showing the filter box.
        allowMove : false,       // Turn moving on or off.
        hoverClass : 'fangorn-hover',
        resolveRefreshIcon : function() {
            return m('i.fa.fa-refresh.fa-spin');
        }
    };
    var grid = new Treebeard(tbOptions);
    var arrays = fixData(data[0].children);
    var currentArray = arrays;
    var WikiTree = new wikiTree('#sortWiki', currentArray);
}

function fixData(data) {
    var oArray = ko.observableArray();
    var oChildArray = ko.observableArray();
    for (var i=0 ; i<data.length ; i++) {
        if (data[i].page.name === 'Home') {
            continue;
        }
        if (data[i].children.length > 0) {
            oChildArray = fixData(data[i].children);            
            oArray.push(new wikiItem({name: data[i].page.name, id: data[i].page.id, sortOrder: data[i].page.sort_order, children: oChildArray}));
        } else {
            oArray.push(new wikiItem({name: data[i].page.name, id: data[i].page.id, sortOrder: data[i].page.sort_order, children: ko.observableArray()}));
        }
    }
    return oArray
}

function wikiItem(item) {
    var self = this;
    self.name = ko.observable(item.name);
    self.id = ko.observable(item.id);
    self.sortOrder = ko.observable(item.sortOrder)
    self.children = item.children;
    self.fold = ko.observable(false);
  }

function assignSortOrderNumber(jsonData) {
    for (var i=0 ; i < jsonData.length ; i++) {
        jsonData[i].sortOrder = i+1;
        if (jsonData[i].children.length > 0) {
            jsonData[i].children = assignSortOrderNumber(jsonData[i].children);
        }
    }
    return jsonData;
  }

function ViewModel(data){
    var self = this;
    self.data = data;
    self.afterMove = function(obj) {
        var parentId = obj.item.id();
        var fold = obj.item.fold;
        var $display = $('.' + parentId);
        var $angle = $('#' + parentId + ' i');
        if (fold) {
            $display.css('display', 'none');
            $angle.attr('fa fa-angle-right');
        } 
    }
    self.expandOrCollapse = function(obj) {
        var parentId = obj.id();
        //alert(parentId)
        var $display = $('.' + parentId)
        var $angle = $('#' + parentId + ' i');
        if ($display.css('display') === 'list-item') {
            $display.css('display', 'none');
            $angle.attr('class', 'fa fa-angle-right');
            obj.fold = true;
        } else {
            $display.css('display', '');
            $angle.attr('class', 'fa fa-angle-down');
            obj.fold = false;
        }
    }
    self.submit = function() {
        var jsonData = JSON.parse(ko.toJSON(self.data));
        var sortedJsonData = assignSortOrderNumber(jsonData);
        $osf.postJSON(
            window.contextVars.wiki.urls.sort,
            {sortedData: sortedJsonData}
        ).done(function(response) {
            const reloadUrl = (location.href).replace(location.search, '')
            window.location.assign(reloadUrl);
        }).fail(function(xhr) {
            alert('error')
        });
    };
}

var wikiTree = function(selector, data) {
    var self = this;
    this.viewModel = new ViewModel(data);
    $osf.applyBindings(self.viewModel, selector);
};

module.exports = WikiMenu;