/**
* Module that controls the S3 Compatible Storage user settings. Includes Knockout view-model
* for syncing data.
*/

var ko = require('knockout');
var $ = require('jquery');
var Raven = require('raven-js');
var bootbox = require('bootbox');
require('js/osfToggleHeight');

var language = require('js/osfLanguage').Addons.s3compat;
var osfHelpers = require('js/osfHelpers');
var addonSettings = require('js/addonSettings');
var ChangeMessageMixin = require('js/changeMessage');

var s3compatSettings = require('./settings.json');

var ExternalAccount = addonSettings.ExternalAccount;

var $modal = $('#s3compatInputCredentials');


function ViewModel(url) {
    var self = this;

    self.properName = 'S3 Compatible Storage';
    self.availableServices = ko.observableArray(s3compatSettings['availableServices']);
    self.selectedService = ko.observable(s3compatSettings['availableServices'][0]);
    self.accessKey = ko.observable();
    self.secretKey = ko.observable();
    self.account_url = '/api/v1/settings/s3compat/accounts/';
    self.accounts = ko.observableArray();

    ChangeMessageMixin.call(self);

    /** Reset all fields from S3 Compatible Storage credentials input modal */
    self.clearModal = function() {
        self.message('');
        self.messageClass('text-info');
        self.selectedService(s3compatSettings['availableServices'][0]);
        self.accessKey(null);
        self.secretKey(null);
    };
    /** Send POST request to authorize S3 Compatible Storage */
    self.connectAccount = function() {
        // Selection should not be empty
        if( !self.accessKey() && !self.secretKey() ){
            self.changeMessage('Please enter both an API access key and secret key.', 'text-danger');
            return;
        }

        if (!self.accessKey() ){
            self.changeMessage('Please enter an API access key.', 'text-danger');
            return;
        }

        if (!self.secretKey() ){
            self.changeMessage('Please enter an API secret key.', 'text-danger');
            return;
        }
        return osfHelpers.postJSON(
            self.account_url,
            ko.toJS({
                host: self.selectedService()['host'],
                access_key: self.accessKey,
                secret_key: self.secretKey,
            })
        ).done(function() {
            self.clearModal();
            $modal.modal('hide');
            self.updateAccounts();

        }).fail(function(xhr, textStatus, error) {
            var errorMessage = (xhr.status === 400 && xhr.responseJSON.message !== undefined) ? xhr.responseJSON.message : language.authError;
            self.changeMessage(errorMessage, 'text-danger');
            Raven.captureMessage('Could not authenticate with S3 Compatible Storage', {
                extra: {
                    url: self.account_url,
                    textStatus: textStatus,
                    error: error
                }
            });
        });
    };

    self.updateAccounts = function() {
        return $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json'
        }).done(function (data) {
            self.accounts($.map(data.accounts, function(account) {
                var externalAccount =  new ExternalAccount(account);
                externalAccount.accessKey = account.oauth_key;
                externalAccount.secretKey = account.oauth_secret;
                return externalAccount;
            }));
            $('#s3compat-header').osfToggleHeight({height: 160});
        }).fail(function(xhr, status, error) {
            self.changeMessage(language.userSettingsError, 'text-danger');
            Raven.captureMessage('Error while updating addon account', {
                extra: {
                    url: url,
                    status: status,
                    error: error
                }
            });
        });
    };

    self.askDisconnect = function(account) {
        var self = this;
        bootbox.confirm({
            title: 'Disconnect S3 Compatible Storage Account?',
            message: '<p class="overflow">' +
                'Are you sure you want to disconnect the S3 Compatible Storage account <strong>' +
                osfHelpers.htmlEscape(account.name) + '</strong>? This will revoke access to S3 Compatible Storage for all projects associated with this account.' +
                '</p>',
            callback: function (confirm) {
                if (confirm) {
                    self.disconnectAccount(account);
                }
            },
            buttons:{
                confirm:{
                    label:'Disconnect',
                    className:'btn-danger'
                }
            }
        });
    };

    self.disconnectAccount = function(account) {
        var self = this;
        var url = '/api/v1/oauth/accounts/' + account.id + '/';
        var request = $.ajax({
            url: url,
            type: 'DELETE'
        });
        request.done(function(data) {
            self.updateAccounts();
        });
        request.fail(function(xhr, status, error) {
            Raven.captureMessage('Error while removing addon authorization for ' + account.id, {
                extra: {
                    url: url,
                    status: status,
                    error: error
                }
            });
        });
        return request;
    };

    self.selectionChanged = function() {
        self.changeMessage('','');
    };

    self.updateAccounts();
}

$.extend(ViewModel.prototype, ChangeMessageMixin.prototype);

function S3CompatUserConfig(selector, url) {
    // Initialization code
    var self = this;
    self.selector = selector;
    self.url = url;
    // On success, instantiate and bind the ViewModel
    self.viewModel = new ViewModel(url);
    osfHelpers.applyBindings(self.viewModel, self.selector);
}

module.exports = {
    S3CompatViewModel: ViewModel,
    S3CompatUserConfig: S3CompatUserConfig
};
