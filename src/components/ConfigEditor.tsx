import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { AriaOpsOptions, MySecureJsonData } from '../types';

const { SecretFormField, FormField } = LegacyForms;

interface Props extends DataSourcePluginOptionsEditorProps<AriaOpsOptions> {}

interface State {}

export class ConfigEditor extends PureComponent<Props, State> {
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
    console.log(jsonData);
    onOptionsChange({ ...options, jsonData });
  };

  onSkipVerifyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    console.log(event.target.checked);
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

    return (
      <div className="gf-form-group">
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
          />
        </div>

        <div className="gf-form">
          <SecretFormField
            isConfigured={
              (secureJsonFields && secureJsonFields.password) as boolean
            }
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
  }
}
