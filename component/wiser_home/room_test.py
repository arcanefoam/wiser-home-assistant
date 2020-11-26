import collections
import datetime
import pytest

from homeassistant.util.dt import as_local

from .room import Room, Away, Auto, HouseBoost, ValveBoost
from . import schedule

Valve = collections.namedtuple('Valve', ['entity_id', 'weight'])
State = collections.namedtuple('State', 'attributes')


@pytest.fixture
def valves():
    return {
        "e1": 1,
        "e2": 1,
    }


@pytest.fixture
def one_valve():
    return [Valve('e1', 1)]


def test_init():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    assert r is not None


def test_name():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    assert r.name == "test"


def test_default_room_temp():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    assert r.room_temp == 20


def test_default_valve_boost():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    assert not r.valve_boost


def test_default_setpoint():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    assert r.setpoint == 20


def test_default_away_temp():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    assert r.away_temp == 16


def test_default_demands_heat():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    assert not r.demands_heat()


def test_default_valve_boost_set_point():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    assert r.valve_boost_set_point() is None


@pytest.mark.asyncio
async def test_away_service_transition_auto_to_away():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    await r.async_away_mode_event(True, 16)
    assert type(r._state) is Away


@pytest.mark.asyncio
async def test_away_service_transition_away_to_auto():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    await r.async_away_mode_event(True, 16)
    await r.async_away_mode_event(False, 16)
    assert type(r._state) is Auto


@pytest.mark.asyncio
async def test_away_service_change_temp():
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched)
    await r.async_away_mode_event(True, 10)
    assert r.away_temp == 10
    assert r.setpoint == 10
    await r.async_away_mode_event(True, 20)
    assert r.away_temp == 20
    assert r.setpoint == 20


@pytest.mark.asyncio
async def test_boost_all_service(one_valve):
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched, valves=one_valve)
    await r.async_boost_all_mode_event(True)
    assert type(r._state) is HouseBoost
    assert r.setpoint == 22
    assert r.demands_heat()


# custom class to be the mock return value
# will override the requests.Response returned from requests.get
class MockServices:

    async def async_call(self, *args):
        print('async_call', args)

    async def async_listen(self, *args):
        print('async_listen', args)


@pytest.mark.asyncio
async def test_boost_from_room(one_valve):
    Hass = collections.namedtuple('Hass', ['services', 'bus'])
    sched = schedule.Schedule(name="test", rules=[])
    r = Room(name="test", schedule=sched, valves=one_valve)
    # FIXME Monkeypatch r._hass
    r._hass = Hass(MockServices(), MockServices())
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 22,
        'boost': 'Up'})
    await r._async_valve_state_change("e1", None, state)
    await r.async_tick(as_local(datetime.datetime.now()))
    assert type(r._state) is ValveBoost
