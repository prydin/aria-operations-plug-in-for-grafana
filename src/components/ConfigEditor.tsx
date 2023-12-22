/*
Aria Operations plug-in for Grafana
Copyright 2023 VMware, Inc.

The BSD-2 license (the "License") set forth below applies to all parts of the 
Aria Operations plug-in for Grafana project. You may not use this file except 
in compliance with the License.

BSD-2 License

Redistribution and use in source and binary forms, with or without 
modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, 
this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this
list of conditions and the following disclaimer in the documentation and/or 
other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE 
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL 
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR 
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER 
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, 
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { AriaOpsOptions, MySecureJsonData } from '../types';

const { SecretFormField, FormField } = LegacyForms;

const SAAS_HOST_SUFFIX = 'www.mgmt.cloud.vmware.com/vrops-cloud';

type Props = DataSourcePluginOptionsEditorProps<AriaOpsOptions>;

type State = object;

export class ConfigEditor extends PureComponent<Props, State> {
  onSaaSChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      isSaaS: event.target.checked,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onRegionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const region = event.target.value;
    const jsonData = {
      ...options.jsonData,
      saasRegion: region,
      host:
        region && region !== 'us'
          ? region + '.' + SAAS_HOST_SUFFIX
          : SAAS_HOST_SUFFIX,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onHostChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      host: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      username: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onAuthSourceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      authSource: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onSkipVerifyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      tlsSkipVerify: event.target.checked,
    };
    onOptionsChange({ ...options, jsonData });
  };

  // Secure field (only sent to the backend)
  onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonData: {
        password: event.target.value,
      },
    });
  };

  onResetPassword = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        password: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        password: '',
      },
    });
  };

  render() {
    const { options } = this.props;
    const { jsonData, secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;

    const details = jsonData.isSaaS ? ( // SaaS fields
      <div>
        <div className="gf-form">
          <FormField
            label="SaaS Region (blank for US)"
            labelWidth={20}
            inputWidth={20}
            onChange={this.onRegionChange}
            value={jsonData.saasRegion || ''}
            placeholder="Aria Operations Host or IP"
          />
        </div>
        <div className="gf-form">
          <SecretFormField
            isConfigured={secureJsonFields && secureJsonFields.password}
            value={secureJsonData.password || ''}
            label="API Key"
            placeholder="Aria Operations API Key"
            labelWidth={20}
            inputWidth={20}
            onReset={this.onResetPassword}
            onChange={this.onPasswordChange}
          />
        </div>
      </div>
    ) : (
      // On premises fields
      <div>
        <div className="gf-form">
          <FormField
            label="Aria Ops Host"
            labelWidth={20}
            inputWidth={20}
            onChange={this.onHostChange}
            value={jsonData.host || ''}
            placeholder="Aria Operations Host or IP"
          />
        </div>
        <div className="gf-form">
          <FormField
            label="Username"
            labelWidth={20}
            inputWidth={20}
            onChange={this.onUsernameChange}
            value={jsonData.username || ''}
            placeholder="Aria Operations Username"
            disabled={!jsonData.isSaaS}
          />
        </div>

        <div className="gf-form">
          <SecretFormField
            isConfigured={secureJsonFields && secureJsonFields.password}
            value={secureJsonData.password || ''}
            label="Password"
            placeholder="Aria Operations Password"
            labelWidth={20}
            inputWidth={20}
            onReset={this.onResetPassword}
            onChange={this.onPasswordChange}
          />
        </div>
        <div className="gf-form">
          <FormField
            label="Authentication Source"
            labelWidth={20}
            inputWidth={20}
            onChange={this.onAuthSourceChange}
            value={jsonData.authSource || 'Local Users'}
            placeholder="Aria Operations Authentication Source"
          />
        </div>
        <div className="gf-form">
          <FormField
            label="Skip TLS verify (UNSAFE!)"
            labelWidth={20}
            inputWidth={20}
            onChange={this.onSkipVerifyChange}
            checked={jsonData.tlsSkipVerify}
            placeholder="Skip TLS verify"
            type="checkbox"
          />
        </div>
      </div>
    );

    return (
      <div className="gf-form-group">
        <FormField
          label="Connecting to SaaS instance?"
          labelWidth={20}
          inputWidth={20}
          onChange={this.onSaaSChange}
          checked={jsonData.isSaaS}
          placeholder="SaaS instance"
          type="checkbox"
        />
        {details}
      </div>
    );
  }
}
