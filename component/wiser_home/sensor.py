"""Adds support for virtual Wiser Home"""
import asyncio
import datetime
import logging
from enum import Enum

import voluptuous as vol

from homeassistant.components.climate import PLATFORM_SCHEMA
from homeassistant.const import (
    CONF_NAME,
    ATTR_TEMPERATURE,
    ATTR_ENTITY_ID,
    SERVICE_TURN_OFF,
    SERVICE_TURN_ON,
)
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers.config_validation import (
    make_entity_service_schema,
    PLATFORM_SCHEMA,
    PLATFORM_SCHEMA_BASE,
)
from homeassistant.core import DOMAIN as HA_DOMAIN, callback
from homeassistant.helpers.event import (
    async_track_time_interval,
)
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.helpers.typing import ConfigType, HomeAssistantType, ServiceDataType
from homeassistant.util.temperature import convert as convert_temperature

from .const import (
    ATTR_AWAY_MODE,
    CONF_BOILER,
    DEFAULT_AWAY_TEMP,
    DOMAIN,
    SCHEDULE_INTERVAL,
    SERVICE_SET_AWAY_TEMP,
    SERVICE_SET_AWAY_MODE,
    SERVICE_BOOST_ALL,
    SERVICE_CANCEL_OVERRIDES,
)
from .config import parse_rooms, CONFIG_SCHEMA

_LOGGER = logging.getLogger(__name__)

PLATFORM_SCHEMA = PLATFORM_SCHEMA.extend(
    CONFIG_SCHEMA
)

SET_AWAY_TEMPERATURE_SCHEMA = make_entity_service_schema(
    {vol.Exclusive(ATTR_TEMPERATURE, "temperature"): vol.Coerce(float)}
)
SET_AWAY_MODE_SCHEMA = make_entity_service_schema(
    {vol.Exclusive(ATTR_AWAY_MODE, "away_mode"): cv.boolean}
)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the Wiser Home platform."""
    name = config.get(CONF_NAME)
    boiler = config.get(CONF_BOILER)
    rooms = parse_rooms(config)
    entity = WiserHome(name, boiler, rooms)
    async_add_entities([entity])

    async def handle_away_temp_service(call):
        """Handle the service."""
        away_temp = call.data.get(ATTR_TEMPERATURE, DEFAULT_AWAY_TEMP)
        await entity.async_set_away_temp(temperature=away_temp)

    async def handle_away_mode_service(call):
        """Handle the service."""
        away_mode = call.data.get(ATTR_AWAY_MODE, False)
        await entity.async_set_away_mode(away_mode=away_mode)

    async def handle_boost_all_service(call):
        """Handle the service."""
        await entity.async_boost_all(call)

    async def handle_cancel_overrides_service(call):
        """Handle the service."""
        await entity.async_cancel_overrides(call)

    hass.services.async_register(
        DOMAIN, SERVICE_SET_AWAY_TEMP, handle_away_temp_service, SET_AWAY_TEMPERATURE_SCHEMA)
    hass.services.async_register(
        DOMAIN, SERVICE_SET_AWAY_MODE, handle_away_mode_service, SET_AWAY_MODE_SCHEMA)
    hass.services.async_register(
        DOMAIN, SERVICE_BOOST_ALL, handle_boost_all_service, make_entity_service_schema({}))
    hass.services.async_register(
        DOMAIN, SERVICE_CANCEL_OVERRIDES, handle_cancel_overrides_service, make_entity_service_schema({}))
    return True


class HeatingMode(Enum):
    AUTO = 'Auto'
    AWAY = 'Away'
    BOOST = 'Boost'


class WiserHome(RestoreEntity):
    """ Implementation of a Virtual Wiser Heat App

    Away Mode:
        Once activated, all rooms return to the Away temperature (default 16°C). When Away mode is active, only rooms
        that have set-point temperatures higher than the Away mode temperature will be affected. For example, if a given
        room is set to 5°C, Away Mode will not force it to the Away temperature.

        While Away Mode overrides Boost, Auto and Manual Mode, it is still possible to manually change the set-point
        temperature and boost individual rooms after activating Away Mode. If one or more rooms have an active Boost at
        the time Away Mode is activated, the Boost will still remain active but Away Mode will limit the temperature of
        these rooms to the Away Mode value if Boost temperatures are higher than the Away Mode temperatures. Upon
        deactivating Away Mode, if any given Boost is still active, each respective room will resume observing the
        Boost temperature until expiry.

        The default temperature can be modified via set_away_temp service.

    """
    
    def __init__(self, name, boiler, rooms):
        self._name = name
        self._mode = HeatingMode.AUTO
        self.boiler_entity_id = boiler
        self.rooms = rooms
        self._attributes = {}
        self._room_for_entity = {}
        self._away_temp = DEFAULT_AWAY_TEMP
        self._boost_all = False
        self._boost_timer_remove = None

    @property
    def name(self):
        """Return the name of the sensor."""
        return self._name

    @property
    def state(self):
        """Return the state of the sensor."""
        return self._mode.value

    @property
    def icon(self):
        """Return the icon of the sensor."""
        return "mdi:power"

    @property
    def device_state_attributes(self):
        """Return attributes for the sensor."""
        return self._attributes

    async def async_update(self):
        """Retrieve latest state."""
        pass

    async def async_added_to_hass(self):
        """Run when entity about to be added."""
        await super().async_added_to_hass()
        # Add listener for each thermostat
        for room in self.rooms:
            room.track_valves(self.hass)
        # Add a time internal to evaluate schedules
        self._attributes['boiler'] = 'Off'
        self._attributes['away_temp'] = self._away_temp
        self._attributes['boost'] = self._boost_all
        async_track_time_interval(self.hass, self._async_control_heater, datetime.timedelta(minutes=SCHEDULE_INTERVAL))

    async def _async_control_heater(self, time, away=False):
        """
        Timer method called every SCHEDULE_INTERVAL.
        Requests all rooms to evaluate their schedule.
        :param time:
        :param away:
        :return:
        """
        for room in self.rooms:
            await room.async_tick(time)

        self._attributes['rooms'] = [room.attributes() for room in self.rooms]
        if any(room.demands_heat() for room in self.rooms):
            _LOGGER.debug("At least one room needs heat, setting boiler on")
            await self._async_heater_turn_on()
        else:
            _LOGGER.debug("No room needs heat, setting boiler off")
            await self._async_heater_turn_off()

    async def _async_heater_turn_on(self):
        """Turn heater toggleable device on."""
        data = {ATTR_ENTITY_ID: self.boiler_entity_id}
        self._attributes['boiler'] = 'On'
        await self.hass.services.async_call(HA_DOMAIN, SERVICE_TURN_ON, data)

    async def _async_heater_turn_off(self):
        """Turn heater toggleable device off."""
        data = {ATTR_ENTITY_ID: self.boiler_entity_id}
        self._attributes['boiler'] = 'Off'
        await self.hass.services.async_call(HA_DOMAIN, SERVICE_TURN_OFF, data)

    async def async_set_away_temp(self, *args, **kwargs) -> None:
        """Set new target temperature."""
        temperature = kwargs.get(ATTR_TEMPERATURE)
        if temperature is None:
            return
        self._away_temp = temperature
        _LOGGER.debug("Wiser Home away temp set to %s", temperature)
        self._attributes['away_temp'] = self._away_temp
        if self._away:
            await self._async_control_heater(time=datetime.datetime.now(), away=True)

    async def async_set_away_mode(self, *args, **kwargs):
        """Set away mode."""
        away = kwargs.get(ATTR_AWAY_MODE)
        if away is None:
            return
        if away:
            self._mode = HeatingMode.AWAY
        else:
            self._mode = HeatingMode.AUTO
        for room in self.rooms:
            await room.async_away_mode_event(away, self._away_temp)

    async def async_boost_all(self, *args, **kwargs):
        """
        Register a timer for one hour and tell all rooms to boost
        """
        self._boost_all = True
        self._boost_timer_remove = async_track_time_interval(
            self.hass,
            self._async_boost_end,
            datetime.timedelta(hours=1))
        for room in self.rooms:
            await room.async_boost_all_mode_event(True)

    async def _async_boost_end(self, *args, **kwargs):
        """
        Method called when the boost is over
        """
        if self._boost_timer_remove is not None:
            self._boost_timer_remove()
        for room in self.rooms:
            await room.async_boost_all_mode_event(False)

    async def async_cancel_overrides(self, *args, **kwargs):
        self._boost_all = False
        for room in self.rooms:
            await room.async_auto_mode_event()





