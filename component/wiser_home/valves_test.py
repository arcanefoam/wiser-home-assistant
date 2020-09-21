import pytest
import collections

from .room import Valves, TempDirection
from . import schedule, util

State = collections.namedtuple('State', 'attributes')


@pytest.fixture
def valves():
    return {
        "e1": 1,
        "e2": 1,
    }


@pytest.fixture
def one_valve():
    return {
        "e1": 1,
    }


def test_init(one_valve):
    sut = Valves(valves=one_valve)
    assert sut is not None


def test_deftemp_is_20(one_valve):
    sut = Valves(valves=one_valve)
    assert sut.room_temp == 20


def test_valve_state_is_stored(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={'local_temperature': 15})
    sut.update_state("e1", state)
    assert sut.room_temp == 15


def test_valve_temp_drop_is_cooling(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={'local_temperature': 15})
    sut.update_state("e1", state)
    assert sut._temp_direction == TempDirection.COOLING


def test_valve_temp_drop_is_heating(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={'local_temperature': 25})
    sut.update_state("e1", state)
    assert sut._temp_direction == TempDirection.HEATING


def test_valve_temp_same_no_change(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={'local_temperature': 20})
    sut.update_state("e1", state)
    assert sut._temp_direction == TempDirection.NONE


def test_heating_if_room_heating(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={'local_temperature': 21})
    sut.update_state("e1", state)
    result = sut.determine_heating(22)
    assert result, "Room should need heating"


def test_no_heating_if_room_heating(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={'local_temperature': 21})
    sut.update_state("e1", state)
    state = State(attributes={'local_temperature': 22})
    sut.update_state("e1", state)
    result = sut.determine_heating(22)
    assert not result, "Room should not need heating"
    state = State(attributes={'local_temperature': 23})
    sut.update_state("e1", state)
    result = sut.determine_heating(22)
    assert not result, "Room should not need heating"


def test_no_heating_if_room_cooling_and_drop_within_hysteresis(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={'local_temperature': 21})
    sut.update_state("e1", state)
    state = State(attributes={'local_temperature': 22})
    sut.update_state("e1", state)
    result = sut.determine_heating(22)
    assert not result, "Room should not need heating"
    state = State(attributes={'local_temperature': 21.8})
    sut.update_state("e1", state)
    result = sut.determine_heating(22)
    assert not result, "Room should not need heating"


def test_heating_if_room_cooling_and_drop_below_hysteresis(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={'local_temperature': 21})
    sut.update_state("e1", state)
    state = State(attributes={'local_temperature': 22})
    sut.update_state("e1", state)
    result = sut.determine_heating(22)
    assert not result, "Room should not need heating"
    state = State(attributes={'local_temperature': 21.4})
    sut.update_state("e1", state)
    result = sut.determine_heating(22)
    assert result, "Room should need heating"


def test_set_schedule_set_point(valves):
    sut = Valves(valves=valves)
    sut.schedule_setpoint(16)
    assert sut._waiting_synch["e1"]
    assert sut._waiting_synch["e2"]
    assert sut._waiting_synch_setpoint == 16


def test_set_schedule_set_point_causes_wait(valves):
    sut = Valves(valves=valves)
    assert not sut.waiting_synch()
    sut.schedule_setpoint(16)
    assert sut.waiting_synch()


def test_detect_boost_plus(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 22,
        'boost': 'Up'})
    sut.update_state("e1", state)
    sut.detect_boost("e1", 20)
    assert sut._valve_boost_temp == 22
    assert sut._valve_boost_dir == "+"


def test_no_boost_plus_if_delta_small(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 21.4,
        'boost': 'Up'})
    sut.update_state("e1", state)
    sut.detect_boost("e1", 20)
    assert sut._valve_boost_temp == 20
    assert sut._valve_boost_dir == 0


def test_no_boost_plus_if_delta_big(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 16,
        'boost': 'Up'})
    sut.update_state("e1", state)
    sut.detect_boost("e1", 20)
    assert sut._valve_boost_temp == 20
    assert sut._valve_boost_dir == 0


def test_detect_boost_minus(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 18,
        'boost': 'Down'})
    sut.update_state("e1", state)
    sut.detect_boost("e1", 20)
    assert sut._valve_boost_temp == 18
    assert sut._valve_boost_dir == "-"


def test_no_boost_minus_if_delta_small(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 18.6,
        'boost': 'Down'})
    sut.update_state("e1", state)
    sut.detect_boost("e1", 20)
    assert sut._valve_boost_temp == 20
    assert sut._valve_boost_dir == 0


def test_no_boost_minus_if_delta_big(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 24,
        'boost': 'Down'})
    sut.update_state("e1", state)
    sut.detect_boost("e1", 20)
    assert sut._valve_boost_temp == 20
    assert sut._valve_boost_dir == 0


def test_no_detect_boost_plus_if_waiting(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 20,
        'boost': 'Up'})
    sut.update_state("e1", state)
    sut.schedule_setpoint(23)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 22,
        'boost': 'Up'})
    sut.update_state("e1", state)
    sut.detect_boost("e1", 23)
    assert sut._valve_boost_temp == 20
    assert sut._valve_boost_dir == 0


def test_no_detect_boost_minus_if_waiting(one_valve):
    sut = Valves(valves=one_valve)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 20,
        'boost': 'Down'})
    sut.update_state("e1", state)
    sut.schedule_setpoint(17)
    state = State(attributes={
        'local_temperature': 20,
        'occupied_heating_setpoint': 18,
        'boost': 'Down'})
    sut.update_state("e1", state)
    sut.detect_boost("e1", 17)
    assert sut._valve_boost_temp == 20
    assert sut._valve_boost_dir == 0
