// Import necessary dependencies and components
import { useState, useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { TopNavigation } from "@cloudscape-design/components";
import PropTypes from 'prop-types';
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import './App.css';

import ChatComponent from './ChatComponent';
import ConfigComponent from './ConfigComponent';

/**
 * Default configuration for the application
 * Pre-configured with hardcoded AWS credentials and settings
 */
const DEFAULT_CONFIG = {
  cognito: {
    userPoolId: 'eu-west-1_B7QPgod64',
    userPoolClientId: '7m3ufk1rae8cj97daqnpas4asv',
    identityPoolId: 'eu-west-1:fe48aae0-ab46-43bf-a4a3-0c79c2c314da',
    region: 'eu-west-1'
  },
  bedrock: {
    agentName: '',
    agentId: '',
    agentAliasId: '',
    region: ''
  },
  strands: {
    enabled: false,
    lambdaArn: '',
    agentName: 'Strands Agent',
    region: ''
  },
  agentcore: {
    enabled: true,
    agentArn: 'arn:aws:bedrock-agentcore:us-east-1:821595636116:runtime/beod_agent_dev-uA38cg8hsF',
    agentName: 'BEOD',
    region: 'us-east-1'
  }
};

/**
 * Main App component that manages the application state and routing
 * Controls the configuration and authentication flow of the application
 * @returns {JSX.Element} The rendered App component
 */
function App() {
  // State to track if the application has been properly configured
  const [isConfigured, setIsConfigured] = useState(false);
  // State to track if user is currently in configuration editing mode
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  //const [bedrockConfig, setBerockConfig] = useState(null);

  /**
   * Effect hook to check for stored configuration in localStorage
   * If no configuration exists, initializes with default configuration
   * Updates the configuration state when editing mode changes
   */
  useEffect(() => {
    const storedConfig = localStorage.getItem('appConfig');
    if (storedConfig && !isEditingConfig) {
      //setBerockConfig(JSON.parse(storedConfig).bedrock);
      const parsedConfig = JSON.parse(storedConfig);
      // Configure Amplify with stored config
      Amplify.configure({
        Auth: {
          Cognito: {
            region: parsedConfig.cognito.region,
            userPoolId: parsedConfig.cognito.userPoolId,
            userPoolClientId: parsedConfig.cognito.userPoolClientId,
            identityPoolId: parsedConfig.cognito.identityPoolId
          },
        }
      });
      setIsConfigured(true);
    } else if (!storedConfig && !isEditingConfig) {
      // Initialize with default configuration if no config exists
      localStorage.setItem('appConfig', JSON.stringify(DEFAULT_CONFIG));
      // Configure Amplify with default config
      Amplify.configure({
        Auth: {
          Cognito: {
            region: DEFAULT_CONFIG.cognito.region,
            userPoolId: DEFAULT_CONFIG.cognito.userPoolId,
            userPoolClientId: DEFAULT_CONFIG.cognito.userPoolClientId,
            identityPoolId: DEFAULT_CONFIG.cognito.identityPoolId
          },
        }
      });
      setIsConfigured(true);
    }
  }, [isEditingConfig]);

  /**
   * Callback handler for when configuration is successfully set
   * Updates the isConfigured state to true
   */
  const handleConfigSet = () => {
    setIsConfigured(true);
  };

  /**
   * Render the appropriate component based on configuration and authentication state
   */
  return (
    <div>
      {!isConfigured || isEditingConfig ? (
        // Show configuration component if not configured or editing
        <ConfigComponent 
          onConfigSet={handleConfigSet} 
          isEditingConfig={isEditingConfig} 
          setEditingConfig={setIsEditingConfig} 
        />
      ) : (
        // Show authenticated component when configured
        <Authenticator.Provider>
          <AuthenticatedComponent onEditConfigClick={() => setIsEditingConfig(true)} />
        </Authenticator.Provider>
      )}
    </div>
  );
};

/**
 * Component that handles the authenticated state of the application
 * Renders the top navigation and manages authentication status
 * @param {Object} props - Component properties
 * @param {Function} props.onEditConfigClick - Callback to handle configuration editing
 * @returns {JSX.Element} The authenticated view of the application
 */
const AuthenticatedComponent = ({ onEditConfigClick }) => {
  // Extract user and authentication status from Amplify's authentication context
  const { user, authStatus } = useAuthenticator((context) => [context.user, context.authStatus]);
  // Track whether authentication is currently in progress
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  /**
   * Update authentication processing state when auth status changes
   */
  useEffect(() => {
    setIsAuthenticating(authStatus === 'processing');
  }, [authStatus]);

  /**
   * Navigation component configuration object
   * Defines the structure and behavior of the top navigation bar
   */
  const components = {
    /**
     * Header component that renders the top navigation bar
     * @returns {JSX.Element} TopNavigation component with settings button
     */
    Header() {
      return (
        <div>
          <TopNavigation
            identity={{
              href: "#",
              title: `Welcome`,
            }}
            utilities={[
              // Settings button configuration
              {
                type: "button",
                iconName: "settings",
                title: "Update settings",
                ariaLabel: "Update settings",
                disableUtilityCollapse: false,
                onClick: onEditConfigClick
              }
            ]}
          />
        </div>
      );
    }
  }

  return (
    <div>
      <div className="centered-container">
        <Authenticator hideSignUp={true} components={components}>
          {isAuthenticating ? (
            <div>Authenticating...</div>
          ) : user ? (
            <ChatComponent user={user} onLogout={() => setIsAuthenticating(false)} onConfigEditorClick={onEditConfigClick}/>
          ) : (
            <div className="tool-bar">
              Please sign in to use the application
            </div>
          )}
        </Authenticator>
      </div>
    </div>
    
  );
}

AuthenticatedComponent.propTypes = {
  onEditConfigClick: PropTypes.func.isRequired
};

export default App;