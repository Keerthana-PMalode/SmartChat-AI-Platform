from typing import Any, Text, Dict, List

from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher


class ActionGetUser(Action):

    def name(self) -> Text:
        return "action_get_user"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any]
    ) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(
            response="utter_welcome_user"
        )

        return []


class ActionRespondMoodGreat(Action):

    def name(self) -> Text:
        return "action_respond_mood_great"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any]
    ) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(
            response="utter_happy"
        )

        return []


class ActionRespondInformWork(Action):

    def name(self) -> Text:
        return "action_respond_inform_work"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any]
    ) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(
            response="utter_faq_working_hours"
        )

        return []