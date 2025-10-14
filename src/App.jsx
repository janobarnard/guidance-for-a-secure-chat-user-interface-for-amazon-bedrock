// Import necessary dependencies and components
import { useState, useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { TopNavigation } from "@cloudscape-design/components";
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import './App.css';

import ChatComponent from './ChatComponent';

const DEFAULT_APP_CONFIG = {
  cognito: {
    userPoolId: 'eu-west-1_B7QPgod64',
    userPoolClientId: '7m3ufk1rae8cj97daqnpas4asv',
    identityPoolId: 'eu-west-1:fe48aae0-ab46-43bf-a4a3-0c79c2c314da',
    region: 'eu-west-1'
  },
  bedrock: {
    agentName: 'BEOD',
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
  const [isAmplifyConfigured, setIsAmplifyConfigured] = useState(false);

  useEffect(() => {
    const configureApp = () => {
      localStorage.setItem('appConfig', JSON.stringify(DEFAULT_APP_CONFIG));

      Amplify.configure({
        Auth: {
          Cognito: {
            region: DEFAULT_APP_CONFIG.cognito.region,
            userPoolId: DEFAULT_APP_CONFIG.cognito.userPoolId,
            userPoolClientId: DEFAULT_APP_CONFIG.cognito.userPoolClientId,
            identityPoolId: DEFAULT_APP_CONFIG.cognito.identityPoolId
          }
        }
      });

      setIsAmplifyConfigured(true);
    };

    configureApp();
  }, []);

  if (!isAmplifyConfigured) {
    return null;
  }

  return (
    <div>
      <Authenticator.Provider>
        <AuthenticatedComponent />
      </Authenticator.Provider>
    </div>
  );
};

/**
 * Component that handles the authenticated state of the application
 * Renders the top navigation and manages authentication status
 * @param {Object} props - Component properties
 * @returns {JSX.Element} The authenticated view of the application
 */
const AuthenticatedComponent = () => {
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
    Header() {
      return (
        <div>
          <TopNavigation
            identity={{
              href: "#",
              title: `Welcome`,
            }}
            utilities={[]}
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
            <ChatComponent user={user} onLogout={() => setIsAuthenticating(false)} />
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

export default App;
