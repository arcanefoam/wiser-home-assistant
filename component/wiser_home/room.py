"""
This module implements the Room class.
"""
import asyncio
import logging
from collections import namedtuple
import datetime
from enum import Enum, auto

from homeassistant.components.climate.const import (
    SERVICE_SET_TEMPERATURE,
)
from homeassistant.components.climate.const import DOMAIN as CLIMATE_DOMAIN
from homeassistant.const import (
    ATTR_ENTITY_ID,
    ATTR_TEMPERATURE,
)
from homeassistant.core import callback, State
from homeassistant.helpers.event import (
    async_track_state_change,
    async_track_time_interval,
)
from homeassistant.util.dt import as_local

from .const import (
    CONF_WEEKDAYS,
    DEFAULT_AWAY_TEMP,
    OFF_VALUE,
    SCHEDULE_INTERVAL,
    TEMP_HYSTERESIS,
)
from .schedule import Schedule, Rule
from .util import RangingSet

_log = logging.getLogger(__name__)

Thermostat = namedtuple('Thermostat', ['entity_id', 'weight'])
BOOST_UP = 2
BOOST_DOWN = 1
boost_values = {
    "Up": BOOST_UP,
    "Down": BOOST_DOWN,
    "None": 0
}
boost_delta = {
    BOOST_UP: 2,
    BOOST_DOWN: -2,
}


class TempDirection(Enum):
    NONE = 0
    HEATING = 1
    COOLING = 2


class Room:
    """A room to be controlled by Wiser Home, identified by a name.
    A rooms has a current room temperature and a current set-point.
    Temperature in a room can be boosted by 2°C, for a period of 30 min,
    1, 2, or 3 hours.
    Rooms can operate in Auto, Manual or Away mode. Away mode is controlled
    by the Wiser Home that contains the room.

    A room can have one or more thermostats. If it has more than one, the
    current room temperature will be the average of the thermostats'
    temperature.

    In automatic mode a room is controlled by its schedule. Schedules are
    defined in the Wiser Home configuration in configuration.yaml.
    If no schedule is defined, the room uses the following schedule:

        Monday – Friday            Saturday – Sunday
          Time       Temp            Time        Temp
        6:30 am     20.0°C          7:00 am     20.0°C
        8:30 am     16.0°C          9:00 am     18.0°C
        4:30 pm     21.0°C          4:00 pm     21.0°C
        10:30 pm    Off*            11:00 pm    Off*

    * Only frost protection is active
    """

    def __init__(self, name=None, valves=None, schedule: Schedule = None):
        if valves is None:
            valves = []
        self._hass = None
        self.schedule = schedule
        self._away_temp = DEFAULT_AWAY_TEMP
        self._boost_all_temp = None
        self._manual_temp = None
        self._setpoint = 20
        self._name = name
        self._heating = False
        self._valves = Valves(valves={v.entity_id: v.weight for v in valves})
        self._valve_boost_timer_remove = None
        self._room_boost_timer_remove = None
        self._state = Auto()
        self._temp_lock = asyncio.Lock()
        if not self.schedule.rules:   # Create default rules
            # Week days
            self.schedule.rules.append(
                Rule(
                    value=20,
                    name="wd morning",
                    start_time=datetime.time(6, 0),
                    end_time=datetime.time(8, 30),
                    constraints={CONF_WEEKDAYS: RangingSet(range(1, 6))}
                )
            )
            self.schedule.rules.append(
                Rule(
                    value=16,
                    name="wd day",
                    start_time=datetime.time(8, 30),
                    end_time=datetime.time(16, 30),
                    constraints={CONF_WEEKDAYS: RangingSet(range(1, 6))}
                )
            )
            self.schedule.rules.append(
                Rule(
                    value=21,
                    name="wd evening",
                    start_time=datetime.time(16, 30),
                    end_time=datetime.time(22, 30),
                    constraints={CONF_WEEKDAYS: RangingSet(range(1, 6))}
                )
            )
            # Weekends
            self.schedule.rules.append(
                Rule(
                    value=20,
                    name="we morning",
                    start_time=datetime.time(7, 0),
                    end_time=datetime.time(9, 0),
                    constraints={CONF_WEEKDAYS: RangingSet({6, 7})}
                )
            )
            self.schedule.rules.append(
                Rule(
                    value=18,
                    name="we day",
                    start_time=datetime.time(9, 0),
                    end_time=datetime.time(16, 0),
                    constraints={CONF_WEEKDAYS: RangingSet({6, 7})}
                )
            )
            self.schedule.rules.append(
                Rule(
                    value=21,
                    name="evening",
                    start_time=datetime.time(16, 0),
                    end_time=datetime.time(23, 0),
                    constraints={CONF_WEEKDAYS: RangingSet({6, 7})}
                )
            )
            # Default
            self.schedule.rules.append(
                Rule(
                    value=OFF_VALUE,
                    name="sleep",
                )
            )

    def __str__(self):
        return f'{self._name}@{self._state}, sp={self._setpoint}'


    @property
    def name(self):
        return self._name

    @property
    def room_temp(self):
        return self._valves.room_temp

    @property
    def valve_boost(self):
        boost, _ = self._valves.has_boost()
        return boost != 0

    @property
    def setpoint(self):
        return self._setpoint

    @property
    def away_temp(self):
        return self._away_temp

    @property
    def boost_all_temp(self):
        return self._boost_all_temp

    def format_room_temp(self):
        return f'{self.room_temp:.1f}'

    def demands_heat(self):
        return self._heating

    def attributes(self):
        boost, _ = self._valves.has_boost()
        return {
            "name": self._name,
            "temperature": self.room_temp,
            "setpoint": self._setpoint if self._setpoint > 5 else OFF_VALUE,
            "heating": self._heating,
            "valve_boost": boost,
            "manual": isinstance(self._state, Manual)
        }

    @callback
    def track_valves(self, hass):
        """
        Request state tracking for room thermostats.
        Called when house is added to Hass
        """
        self._hass = hass
        self._valves.track_state_change(hass, self._async_valve_state_change)

    @callback
    def validate_value(self, value):
        return value

    @callback
    def valve_boost_set_point(self):
        _, temp = self._valves.has_boost()
        return temp

    async def _async_valve_state_change(self, entity_id: str, old_state: State, new_state: State) -> None:
        """ Handle thermostat state changes. """
        if new_state is None:
            return
        self._valves.update_state(entity_id, new_state)
        self._valves.detect_boost(entity_id, self._setpoint)
        await self._async_send_set_point(entity_id)

    async def _async_send_set_point(self, entity_id):
        """ Send the current set-point to all the valves """
        async with self._temp_lock:
            data = {
                ATTR_ENTITY_ID: entity_id,
                ATTR_TEMPERATURE: self._setpoint
            }
            await self._hass.services.async_call(CLIMATE_DOMAIN, SERVICE_SET_TEMPERATURE, data)

    async def _async_determine_heating(self, time):
        """
        Determine if the room requires heating based on the desired set-point (from the current state) and the room
        temperature
        :param time: the current time.
        """
        new_setpoint = await self._state.setpoint(self,  as_local(time))
        _log.debug("determine_heating %s, new_sp = %s, time = %s", self, new_setpoint, as_local(time))
        if new_setpoint is not None:
            old_setpoint = self._setpoint
            self._setpoint = new_setpoint
            if old_setpoint != new_setpoint:
                self._valves.schedule_setpoint(new_setpoint)
            self._heating = self._valves.determine_heating(self._setpoint)
            _log.info("Room %s demands heat: %s", self, self._heating)

    async def async_tick(self, time):
        """
        Called by the house on its 'control heater' timer. Schedule changes are calculated here.
        If the state is not Away and there is a valve boost, respond
        :param time:
        :return:
        """
        await self._async_determine_heating(time)
        if not isinstance(self._state, Away) and not isinstance(self._state, ValveBoost) and self.valve_boost:
            _log.info("Room %s has valve boost", self.name)
            self._room_boost_timer_remove = None    # Cancel room boost
            self._state = self._state.on_event(Event.VALVE_BOOST)
            self._valve_boost_timer_remove = async_track_time_interval(
                self._hass,
                self.async_valve_boost_end,
                datetime.timedelta(hours=1))

    async def async_away_mode_event(self, away, set_point):
        """
        Called by the house when set to away mode
        :param away: True if set to away.
        :param set_point: The away set-point
        """
        _log.info("Room %s away mode: %s", self, set_point)
        self._away_temp = set_point
        self._state = self._state.on_event(Event.AWAY_ON if away else Event.AWAY_OFF)
        await self._async_determine_heating(as_local(datetime.datetime.now()))

    async def async_boost_all_mode_event(self, boost):
        """
        Called when the house when a boost-all is requested. The boost set-point will be the current room temperature
        + 2°C
        :param boost: True if boost requested
        """
        _log.info("Room %s boost all mode: %s", self, boost)
        self._boost_all_temp = self.room_temp + (2 if boost else 0)
        self._state = self._state.on_event(Event.BOOST_ALL if boost else Event.CANCEL_ALL)
        await self._async_determine_heating(as_local(datetime.datetime.now()))

    async def async_manual_temp_event(self, manual, set_point):
        """
        Called when the room temperature is set manually (via UI)
        :param manual:
        :param set_point:
        :return:
        """
        _log.info("Room %s manual temp: %s", self, set_point)
        self._manual_temp = set_point
        self._state = self._state.on_event(Event.MANUAL if manual else Event.AUTO)
        await self._async_determine_heating(as_local(datetime.datetime.now()))

    async def async_boost_room_event(self, set_point, duration):
        """
        Called when the room is set to boost (via UI).
        :param set_point: The target set-point
        :param duration: The duration of the boost: 30, 60 (1hr), 120 (2hr) or 180(3hr). If 0, boost is cancelled.
        """
        _log.info("Room %s boost_room temp: %s for %d", self, set_point, duration)
        if duration == 0:
            await self.async_auto_mode_event()
        else:
            self._valve_boost_timer_remove = None   # Cancel valve boost
            self._manual_temp = set_point
            self._room_boost_timer_remove = async_track_time_interval(
                self._hass,
                self.async_room_boost_end,
                datetime.timedelta(minutes=duration))
            self._state = self._state.on_event(Event.ROOM_BOOST)
        await self._async_determine_heating(as_local(datetime.datetime.now()))

    async def async_auto_mode_event(self):
        """
        Called when the room is set to auto mode. This can be via the room UI or the house 'Cancel all'
        """
        _log.info("Room %s auto mode", self)
        self._setpoint = self.room_temp
        self._state = self._state.on_event(Event.AUTO)
        await self._async_determine_heating(as_local(datetime.datetime.now()))

    async def async_valve_boost_end(self, *args):
        """
        Listener for ending the valve boost.
        :param kwargs: other event values
        """
        _log.info("Room %s boost end", self)
        if self._valve_boost_timer_remove is not None:
            self._valve_boost_timer_remove()
        self._valve_boost_timer_remove = None
        self._state = self._state.on_event(Event.AUTO)
        await self._async_determine_heating(as_local(datetime.datetime.now()))

    async def async_room_boost_end(self, *args):
        """
        Listener for ending the room boost
        :param kwargs:
        :return:
        """
        _log.debug("async_room_boost_end")
        if self._room_boost_timer_remove is not None:
            self._room_boost_timer_remove()
        self._room_boost_timer_remove = None
        self._state = self._state.on_event(Event.AUTO)
        await self._async_determine_heating(as_local(datetime.datetime.now()))


class Valves:
    """
    Represents a group of valves in a room. The temperature of the room and the valve boost is aggregated from
    all the valves in the group
    """

    def __init__(self, valves=None, temp_direction=TempDirection.NONE, room_temp=20):
        if valves is None:
            valves = {}
        self._valves = valves
        self._room_temp = room_temp
        self._temp_direction = temp_direction
        self._weight_sum = sum(self._valves.values())
        self._valve_set_point = {}
        self._waiting_synch = {}
        for t_id in self._valves:
            self._waiting_synch[t_id] = False
        self._waiting_synch_setpoint = None
        self._valve_boost = {}
        self._valve_boost_dir = 0
        self._valve_boost_temp = None
        self._schedule_changed = False

    @property
    def room_temp(self):
        return self._room_temp

    @callback
    def update_state(self, entity_id, state):
        """
        Calculated the local temperature and store the valve state.
        the weighted average
        :param entity_id:
        :param state:
        :return:
        """
        if entity_id in self._valves:
            try:
                local_temp = state.attributes["local_temperature"]
            except KeyError:
                _log.warning("Valve state does not has local temperature information")
            else:
                prev_temp = self._room_temp
                if len(self._valves) == 1:
                    self._room_temp = local_temp
                else:
                    self._room_temp -= (self._room_temp * self._valves[entity_id]) / self._weight_sum
                    self._room_temp += (local_temp * self._valves[entity_id]) / self._weight_sum
                if prev_temp > self._room_temp:
                    self._temp_direction = TempDirection.COOLING
                elif prev_temp < self._room_temp:
                    self._temp_direction = TempDirection.HEATING
                else:
                    self._temp_direction = TempDirection.NONE
            try:
                valve_set_point = state.attributes["occupied_heating_setpoint"]
            except KeyError:
                _log.warning("Valve state does not has occupied heating setpoint information")
            else:
                self._valve_set_point[entity_id] = valve_set_point
                if self.waiting_synch() and (valve_set_point == self._waiting_synch_setpoint):
                    # We where waiting for synch and it was received
                    _log.debug("Valve synched %s", entity_id)
                    self._waiting_synch[entity_id] = False
            try:
                self._valve_boost[entity_id] = state.attributes["boost"]
            except KeyError:
                _log.warning("Valve state does not has occupied heating setpoint information")

    @callback
    def determine_heating(self, target_temp):
        if self._temp_direction == TempDirection.COOLING:
            return target_temp > (self._room_temp + TEMP_HYSTERESIS)
        else:
            return target_temp > self._room_temp

    @callback
    def schedule_setpoint(self, setpoint):
        for t_id in self._valves:
            self._waiting_synch[t_id] = True
        self._waiting_synch_setpoint = setpoint

    @callback
    def has_boost(self):
        return self._valve_boost_dir, self._valve_boost_temp

    @callback
    def detect_boost(self, entity_id, set_point):
        """ Is there a valve boost?
            Valves keep the boost flag 'ad infinitum', that is, once the user turns the boost, the valve's state
            ("boost") attribute remains in the last turned-to position. Hence, the only way to detect a boost is if
            the valve's set-point changes when the change does not come from us.
        """
        if not self.waiting_synch():
            # We did not initiate the setpoint change
            vale_setpoint = self._valve_set_point[entity_id]
            if vale_setpoint is not None:
                delta = set_point - vale_setpoint
                _log.debug("Room valve %s boost delta %s", delta, entity_id)
                # Valve boost is 2°
                if delta < -1.5 and self._valve_boost[entity_id] == "Up":
                    _log.debug("%s BOOST UP", entity_id)
                    self._valve_boost_temp = self._room_temp + 2
                    self._valve_boost_dir = "+"
                    return
                elif delta > 1.5 and self._valve_boost[entity_id] == "Down":
                    _log.debug("%s BOOST DOWN", entity_id)
                    self._valve_boost_temp = self._room_temp - 2
                    self._valve_boost_dir = "-"
                    return
        self._valve_boost_temp = self._room_temp
        self._valve_boost_dir = 0

    @callback
    def waiting_synch(self):
        return any(self._waiting_synch.values())

    def track_state_change(self, hass, method):
        for t_id in self._valves:
            async_track_state_change(hass, t_id, method)


class Event(Enum):
    AWAY_ON = auto()
    AWAY_OFF = auto()
    BOOST_ALL = auto()
    CANCEL_ALL = auto()
    VALVE_BOOST = auto()
    MANUAL = auto()
    ROOM_BOOST = auto()
    AUTO = auto()


class RoomState(object):
    """
    We define a state object which provides some utility functions for the
    individual states within the state machine.
    """

    def __init__(self):
        _log.debug('Entering state %s', str(self))

    def on_event(self, event):
        """
        Handle events that are delegated to this State.
        """
        pass

    async def setpoint(self, room, time):
        """
        Determines the target temperature. The target temperature is calculated
        differently for each state.
        :param room:
        :param time:
        :return:
        """
        pass

    def __repr__(self):
        """
        Leverages the __str__ method to describe the State.
        """
        return self.__str__()

    def __str__(self):
        """
        Returns the name of the State.
        """
        return self.__class__.__name__


class Auto(RoomState):
    """
    The Room is in Auto mode, following the shcedule
    """

    def on_event(self, event):
        if event == Event.AWAY_ON:
            return Away()
        elif event == Event.BOOST_ALL:
            return HouseBoost()
        elif event == Event.VALVE_BOOST:
            return ValveBoost()
        elif event == Event.ROOM_BOOST:
            return RoomBoost()
        return self

    async def setpoint(self, room, time):
        result = None
        if room.schedule is not None:
            result = await room.schedule.evaluate(room, time)
        if result is None:
            _log.warning("No suitable value found in schedule. Not changing set-points.")
            result = room.set_point
        else:
            new_scheduled_value, _ = result[:2]
            result = new_scheduled_value if new_scheduled_value != OFF_VALUE else 5
        return result


class Away(RoomState):
    """
    The state which indicates that house is in away mode
    """

    def on_event(self, event):
        if event == Event.AWAY_OFF:
            return Auto()
        return self

    async def setpoint(self, room, time):
        return room.away_temp


class HouseBoost(RoomState):
    """
    The state which indicates that the house is in boost all
    """

    def on_event(self, event):
        if event == Event.CANCEL_ALL:
            return Auto()
        elif event == Event.VALVE_BOOST:
            return ValveBoost()
        elif event == Event.MANUAL:
            return Manual()
        elif event == Event.ROOM_BOOST:
            return RoomBoost()
        return self

    async def setpoint(self, room, time):
        return room.boost_all_temp


class ValveBoost(RoomState):
    """
    The state which indicates that the room is in boost via valve
    """

    def on_event(self, event):
        if event == Event.AUTO:
            return Auto()
        elif event == Event.MANUAL:
            return Manual()
        return self

    async def setpoint(self, room, time):
        return room.valve_boost_set_point()


class Manual(RoomState):
    """
    The state which indicates that the room is in manual mode
    """

    def on_event(self, event):
        if event == Event.AWAY_ON:
            return Away()
        elif event == Event.MANUAL:
            return Manual()
        elif event == Event.VALVE_BOOST:
            return ValveBoost()
        elif event == Event.AUTO:
            return Auto()
        return self

    async def setpoint(self, room, time):
        return room.manual_temp


class RoomBoost(RoomState):
    """
    The state which indicates that the room is in boost via room
    """

    def on_event(self, event):
        if event == Event.AUTO:
            return Auto()
        elif event == Event.VALVE_BOOST:
            return ValveBoost()

    async def setpoint(self, room, time):
        return room.manual_temp
