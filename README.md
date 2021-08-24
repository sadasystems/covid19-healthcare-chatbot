# COVID-19 Healthcare Virtual Agent using Google Dialogflow CX platform
A conversational chatbot to help companies to support their employees in:

1. Issuing a Clearance pass that is required for entering the office building. Employees will complete a health screening and get the clearance pass for reporting to work in person.

1. Providing guidance to employees on how to isolate or quarantine and for how long - It will ask a series of questions to provide the correct guidance for the individual’s situation.

1. Helping them find nearby COVID-19 vaccine centers based on various attributes; for example, if drop-ins are allowed, wheelchair accessibility, nearest centers from the individual’s address, etc. It will gather information from the customer and provide them vaccine center details include links to make an online appointment using the rich cards. It will use a webhook to fetch real-time data maintained by the SF Public Health Department.

1. Locating nearby Cornavirus Testing centers within 20 miles of the location provide by the visitor, etc. It will gather information from the customer and provide them testing location details include eligibility information for accessing testing at this location. The DialogFlow will use a webhook to fetch real-time data maintained by the SF Public Health department of testing locations.

## Approach
Dialogflow Fulfillment mechanism is using multiple webhooks built using node.js (deployed as GAE apps).
This module is a webhook example for Dialogflow. The webhook connects to a Cloud Firestore to validate the visitor by email (or employee id) and storing clearance passes.

## Technical Stack
* Cloud Firestore
* GAE apps
* Dialogflow CX

## Project Structure
```
.
└── covid19-healthcare-chatbot
    ├── exported_agent_COVID-19 Healthcare Virtual Agent.blob # Dialogflow CX Virtual Agent
    ├── webhook-dialogflow # Webhook codebase for deployment
        ├── covid19-clearancepass # Webhook required for validating vistor's email/empId in Firestore
            ├── app.js
            ├── package.json
        ├── app.yaml
    ├── covid19-vaccine-and-testing-locations # Webhook required for finding vaccine and testing locations in realtime
        ├── app.js
        ├── package.json
        ├── app.yaml
    ├── README.md # Deployment instructions
```

## Setup Instructions
### Project Setup
How to setup your project for this example can be found [here](https://cloud.google.com/dialogflow/cx/docs/quick/setup).

### Dialogflow Agent Setup

1. Build an agent by following the instructions [here](https://cloud.google.com/dialogflow/cx/docs/quick/build-agent).
1. Import (restore) the agent using the following instructions [here](https://cloud.google.com/dialogflow/cx/docs/concept/agent#export).
1. Follow the instructions to restore the agent from "exported_agent_COVID-19 Healthcare Virtual Agent.blob".


### Google App Engine Setup
This implementation is deployed on GCP using App Engine.
More info [here](https://cloud.google.com/appengine/docs/standard/nodejs/quickstart).

To run the node.js scripts on GCP, the `gcloud` command-line tool from the Google Cloud SDK is needed.
Refer to the [installation](https://cloud.google.com/sdk/install) page for the appropriate
instructions depending on your platform.

Note that this project has been tested on a Unix-based environment.

After installing, make sure to initialize your Cloud project:

`$ gcloud init`

### Cloud Firestore Setup (Use Native mode database)
Quick start for Cloud Firestore can be found [here](https://cloud.google.com/firestore/docs/quickstart-servers#create_a_in_native_mode_database).

Make sure to setup rules for allowing writes on the new database

    rules_version = '2';
    service cloud.firestore {
        match /databases/{database}/documents {
            match /{document=**} {
                allow read, write: if request.auth != null;
            }
        }
    }

#### How to add data
This example connects to a Cloud Firestore with a collection with the following specification:

    Root collection
     user-data =>
         document_id
             uCQVcprA2PWMPOD4XJTi => {
                 'email': 'alok.gupta@pridequest.com',
                 'empId': 12345
             }

Examples how to add data to a collection can be found [here](https://cloud.google.com/firestore/docs/quickstart-servers#add_data).

    const Firestore = require('@google-cloud/firestore');
    const db = new Firestore({
        projectId: 'YOUR_PROJECT_ID',
        keyFilename: '/path/to/keyfile.json',
    });

    const docRef = db.collection('user-data').doc('12345');

    await docRef.set({
        empId: 12345,
        email: 'alok.gupta@pridequest.com'
    });

## Webhook App(s) Deployment

### Clearance Pass App
#### Configure env variable values in app.yaml file
    $ cd ./covid19-healthcare-chatbot/webhook-dialogflow/covid19-clearancepass
    $ nano app.yaml
        COMPANY_DOMAIN: pridequest.com
   
#### Deploy the app on GCP App Engine
    $ cd ./covid19-healthcare-chatbot/webhook-dialogflow/covid19-clearancepass
    $ gcloud app deploy
* Copy the target url

### COVID-19 Vaccine Access Points and Testing Centers App

#### Signup for access to SFData data sets
* Signup to access San Francisco Datasets [here](https://data.sfgov.org/signup)
* Create API key (personal authentication credentials) for calling API calls using HTTP Basic Authentication [here](https://data.sfgov.org/profile/edit/developer_settings)
* Encode clientId:secret in Base64 format [here](https://toolbox.googleapps.com/apps/encode_decode/)

#### Configure env variable values in app.yaml file
    $ cd ./covid19-healthcare-chatbot/covid19-vaccine-and-testing-locations
    $ nano app.yaml
    
        COVID19_TESTING_CENTER_API: https://data.sfgov.org/resource/dtit-7gp4.json
        COVID19_TESTING_CENTER_API_BEARER_TOKEN: 'Basic <Base64 encoded clientid:secret>'
        COVID19_TESTING_CENTER_RADIUS_METERS: 32187
        COVID19_TESTING_CENTER_RADIUS_MILES: 20

        COVID19_VACCINE_ACCESS_POINTS_API: https://data.sfgov.org/resource/bw5r-gd57.json
        COVID19_VACCINE_ACCESS_POINTS_API_BEARER_TOKEN: 'Basic <Base64 encoded clientid:secret>'
        COVID19_VACCINE_ACCESS_POINTS_RADIUS_METERS: 32187
        COVID19_VACCINE_ACCESS_POINTS_RADIUS_MILES: 20
        MAX_NUMBER_OF_LOCATIONS_TO_FETCH: 3

#### Deploy the app on GCP App Engine
    $ gcloud app deploy
* Copy the target url

#### Configure Target URLs in your agent
1. Go to your agent in CX console and click on Manage > Webhooks.
1. Edit the webhooks' values and change the URL into the field labeled Webhook URL.

    1. COVID-19-Healthcare-Webhook-ClearancePass
        `https://<paste here>/clearance-pass`

    1. COVID-19-Healthcare-Webhook-Locations
        `https://<paste here>>/covid19-locations`
1. Click Save.
   
## Configure Dialogflow Messenger 
You can integrate the text-based DF Messenger by following these steps [here](https://cloud.google.com/dialogflow/cx/docs/concept/integration/dialogflow-messenger)

## Usage
### Dialogflow Agent Example(s)

#### COVID-19 Get a Clearance Pass
    [User] Hello,
    ↳ [Agent] Hi there! 👋 I'm the COVID-19 Healthcare virtual agent.
    [User] I need a clearance pass
    ↳ [Agent] Please provide your company's email address.
    [User] alok.gupta@pridequest.com
    ↳ [Agent] Have you experienced any of the following symptoms of COVID-19 in the past 10 days?
        {...}
    [User] ...

#### COVID-19 Self Assessment
    [User] Hello,
    ↳ [Agent] Hi there! 👋 I'm the COVID-19 Healthcare virtual agent.
    [User] How long to stay home?
    ↳ [Agent] Welcome to our COVID-19 self-assessment tool. Say "Start COVID-19 Self Assessment"
    [User] Start COVID-19 Self Assessment
    ↳ [Agent] ...
    [User] ...

#### Find nearby Vaccine Access Points
    [User] Hello,
    ↳ [Agent] Hi there! 👋 I'm the COVID-19 Healthcare virtual agent.
    [User] Find Vaccine access points nearby my location
    ↳ [Agent] Please enter your location (ex: 2401 Keith Street, San Francisco 94124)
    [User] 212 Rey St, San Francisco, CA 94134
    ↳ [Agent] Are you looking for a drop-in appointment only?
    [User] Yes
    ↳ [Agent] Do you need wheelchair accessible location?
    [User] Yes
    ↳ [Agent] 3 vaccine access point(s) within 20 miles of: 212 Rey St, San Francisco, CA 94134

#### Find nearby Coronavirus Testing Centers
    [[User] Hello,
    ↳ [Agent] Hi there! 👋 I'm the COVID-19 Healthcare virtual agent.
    [User] Help me find a coronavirus testing center
    ↳ [Agent] Please enter your location (ex: 2401 Keith Street, San Francisco 94124)
    [User] 58 Middle Point Rd, San Francisco, CA 94124
    ↳ [Agent] 3 coronavirus testing center(s) within 20 miles of: 58 Middle Point Rd, San Francisco, CA 94124

## License
All solutions within this repository are provided under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license. Please see the [LICENSE](/LICENSE) file for more detailed terms and conditions.
