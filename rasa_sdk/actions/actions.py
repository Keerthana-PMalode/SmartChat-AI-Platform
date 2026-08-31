from typing import Any

from rasa_sdk.executor import CollectingDispatcher

from rasa_sdk import Action, Tracker


class ActionGetUser(Action):

    def name(self) -> str:
        return "action_get_user"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: dict[str, Any],
    ) -> list[dict[str, Any]]:

        dispatcher.utter_message(response="utter_welcome_user")

        return []


class ActionRespondMoodGreat(Action):

    def name(self) -> str:
        return "action_respond_mood_great"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: dict[str, Any],
    ) -> list[dict[str, Any]]:

        dispatcher.utter_message(response="utter_happy")

        return []


class ActionRespondInformWork(Action):

    def name(self) -> str:
        return "action_respond_inform_work"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: dict[str, Any],
    ) -> list[dict[str, Any]]:

        dispatcher.utter_message(response="utter_faq_working_hours")

        return []
