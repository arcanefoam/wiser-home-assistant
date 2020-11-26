"""
This module contains the CONFIG_SCHEMA for validation with voluptuous.
Modified from hass-apps (https://github.com/efficiosoft/hass-apps)
"""
import logging
import typing as T

import datetime
import traceback
from collections import OrderedDict

import voluptuous as vol

import homeassistant.helpers.config_validation as cv
from homeassistant.const import (
    CONF_NAME,
    CONF_ENTITY_ID,
    CONF_UNIQUE_ID)

from . import schedule, util
from .const import (
    CONF_AT_STARTUP,
    CONF_BOILER,
    CONF_DAYS,
    CONF_END,
    CONF_END_DATE,
    CONF_EVENTS,
    CONF_EXPR,
    CONF_EXPR_ENV,
    CONF_MONTHS,
    CONF_ROOMS,
    CONF_RULES,
    CONF_SCHEDULE,
    CONF_SCH_APPEND,
    CONF_SCH_PREPEND,
    CONF_SCH_SNIPPETS,
    CONF_START,
    CONF_START_DATE,
    CONF_THERM,
    CONF_VALUE,
    CONF_WEEKDAYS,
    CONF_WEEKS,
    CONF_YEARS,
    CONF_WEIGHT,
    DEFAULT_NAME,
)
from .room import Room, Thermostat

_LOGGER = logging.getLogger(__name__)


def build_schedule_rule(rule: dict) -> schedule.Rule:
    """Builds and returns a schedule rule from the given rule
    definition."""

    constraints = {}
    for name, value in rule.items():
        if name in schedule.Rule.CONSTRAINTS:
            constraints[name] = value

    expr = None
    expr_raw = rule.get(CONF_EXPR)
    if expr_raw is not None:
        expr_raw = expr_raw.strip()
        try:
            expr = util.compile_expression(expr_raw)
        except SyntaxError:
            traceback.print_exc(limit=0)
            raise vol.Invalid("Couldn't compile expression: {}".format(repr(expr_raw)))

    kwargs = {
        "start_time": rule[CONF_START][0],
        "start_plus_days": rule[CONF_START][1],
        "end_time": rule[CONF_END][0],
        "end_plus_days": rule[CONF_END][1],
        "constraints": constraints,
        "expr": expr,
        "expr_raw": expr_raw,
        CONF_VALUE: rule.get(CONF_VALUE),
    }

    if CONF_RULES in rule:
        return schedule.SubScheduleRule(rule[CONF_RULES], **kwargs)
    return schedule.Rule(**kwargs)


def build_schedule(rules: T.Iterable[schedule.Rule]) -> schedule.Schedule:
    """Returns a Scheedule containing the given Rule objects."""

    sched = schedule.Schedule()
    for rule in rules:
        sched.rules.append(rule)
    return sched


def parse_rooms(cfg: dict) -> dict:
    """Creates Room and other objects after config has been parsed."""

    # pylint: disable=too-many-locals

    # name schedule snippets
    cfg[CONF_SCH_PREPEND].name = "prepend"
    cfg[CONF_SCH_APPEND].name = "append"
    for name, sched in cfg[CONF_SCH_SNIPPETS].items():
        sched.name = name

    # Build Room objects.
    rooms = []
    for room_name, room_data in cfg[CONF_ROOMS].items():

        # thermostats
        therms = []
        for t_data in room_data[CONF_THERM]:
            therms.append(Thermostat(t_data[CONF_ENTITY_ID], t_data[CONF_WEIGHT]))

        # complete the room's schedule.
        rules = []
        if cfg[CONF_SCH_PREPEND].rules:
            rules.append(schedule.SubScheduleRule(cfg[CONF_SCH_PREPEND]))
        if room_data[CONF_SCHEDULE].rules:
            room_data[CONF_SCHEDULE].name = "room-individual"
            _LOGGER.debug("schedule %s", room_data[CONF_SCHEDULE].rules)
            rules.append(schedule.SubScheduleRule(room_data[CONF_SCHEDULE]))
        if cfg[CONF_SCH_APPEND].rules:
            rules.append(schedule.SubScheduleRule(cfg[CONF_SCH_APPEND]))
        sched = schedule.Schedule(name=room_name, rules=rules)

        del room_data[CONF_THERM]
        del room_data[CONF_SCHEDULE]

        room = Room(room_name, therms, sched)
        rooms.append(room)

    return rooms


def schedule_rule_pre_hook(rule: dict) -> dict:
    """Copy value for the expression and value keys over from alternative names."""

    rule = rule.copy()
    util.normalize_dict_key(rule, CONF_EXPR, "x")
    util.normalize_dict_key(rule, CONF_VALUE, "v")
    return rule


def validate_rule_paths(sched: schedule.Schedule) -> schedule.Schedule:
    """A validator to be run after schedule creation to ensure
    each path contains at least one rule with an expression or value.
    A ValueError is raised when this check fails."""

    for path in sched.unfolded:
        if path.is_final and not list(path.rules_with_expr_or_value):
            raise ValueError(
                "No expression or value specified along the path {}.".format(path)
            )

    return sched


########## MISCELLANEOUS


def build_range_spec_validator(  # type: ignore
    min_value: int, max_value: int
) -> vol.Schema:
    """Returns a validator for range specifications with the given
    min/max values."""

    return vol.All(
        vol.Any(int, str), lambda v: util.expand_range_spec(v, min_value, max_value)
    )


########## SCHEMAS

ENTITY_ID_VALIDATOR = vol.Match(r"^[A-Za-z_]+\.[A-Za-z0-9_]+$")
PARTIAL_DATE_SCHEMA = vol.Schema(
    {
        vol.Optional("year"): vol.All(int, vol.Range(min=1970, max=2099)),
        vol.Optional("month"): vol.All(int, vol.Range(min=1, max=12)),
        vol.Optional("day"): vol.All(int, vol.Range(min=1, max=31)),
    }
)
TIME_VALIDATOR = vol.All(vol.Match(util.TIME_REGEXP), util.parse_time_string)
RULE_TIME_VALIDATOR = vol.All(
    vol.Match(
        util.RULE_TIME_REGEXP, msg="correct format: [<HH>:<MM>[:<SS>]][{+-}<days>d]"
    ),
    util.parse_rule_time_string,
)

# This schema does no real validation and default value insertion,
# it just ensures a dictionary containing string keys and dictionary
# values is given.
DICTS_IN_DICT_SCHEMA = vol.Schema(
    vol.All(lambda v: v or {}, {util.CONF_STR_KEY: vol.All(lambda v: v or {}, dict)})
)

########## SCHEDULES

SCHEDULE_RULE_SCHEMA = vol.Schema(
    vol.All(
        lambda v: v or {},
        schedule_rule_pre_hook,
        {
            CONF_RULES: lambda v: SCHEDULE_SCHEMA(  # type: ignore  # pylint: disable=unnecessary-lambda
                v
            ),
            CONF_EXPR: str,
            CONF_VALUE: object,
            vol.Optional(CONF_NAME, default=None): vol.Any(str, None),
            vol.Optional(CONF_START, default=(None, None)): vol.Any(
                RULE_TIME_VALIDATOR, (None,)
            ),
            vol.Optional(CONF_END, default=(None, None)): vol.Any(
                vol.All(
                    RULE_TIME_VALIDATOR,
                    (
                        None,
                        datetime.time,
                        vol.Range(min=0, msg="end time can't be shifted backwards"),
                    ),
                ),
                (None,),
            ),
            vol.Optional(CONF_YEARS): build_range_spec_validator(1970, 2099),
            vol.Optional(CONF_MONTHS): build_range_spec_validator(1, 12),
            vol.Optional(CONF_DAYS): build_range_spec_validator(1, 31),
            vol.Optional(CONF_WEEKS): build_range_spec_validator(1, 53),
            vol.Optional(CONF_WEEKDAYS): build_range_spec_validator(1, 7),
            vol.Optional(CONF_START_DATE): PARTIAL_DATE_SCHEMA,
            vol.Optional(CONF_END_DATE): PARTIAL_DATE_SCHEMA,
        },
        build_schedule_rule,
    )
)

SCHEDULE_SCHEMA = vol.Schema(
    vol.All(lambda v: v or [], [SCHEDULE_RULE_SCHEMA], build_schedule)
)

SCHEDULE_SNIPPETS_SCHEMA = vol.Schema(
    vol.All(lambda v: v or {}, {util.CONF_STR_KEY: SCHEDULE_SCHEMA})
)

########## THERMOSTATS


THERMOSTAT_INFO_SCHEMA = vol.Schema(
    vol.All(
        {
            vol.Required(CONF_ENTITY_ID): cv.entity_id,
            vol.Optional(CONF_WEIGHT, default=1.0): vol.All(vol.Coerce(int), vol.Range(min=1, max=20)),    #  Specify how individual values should be weighted when calculating the average value. The default weight is 1 and a weight of 0 causes the value to be excluded completely. You may want to use this feature to indicate that some values are more or less important than others and have this fact reflected in the statistics.
        },
    )
)

THERMOSTAT_SCHEMA = vol.Schema(
    vol.All(lambda v: v or [], [THERMOSTAT_INFO_SCHEMA])
)

########## ROOMS

ROOM_SCHEMA = vol.Schema(
    vol.All(
        lambda v: v or [],
        {
            vol.Required(CONF_THERM): THERMOSTAT_SCHEMA,
            vol.Optional(CONF_SCHEDULE, default=list): vol.All(
                SCHEDULE_SCHEMA, validate_rule_paths
            ),
        },
    )
)


########## STATISTICS

STATISTICAL_PARAMETER_BASE_SCHEMA = vol.Schema({vol.Required("type"): str}, extra=True)


########## MAIN CONFIG SCHEMA

CONFIG_SCHEMA = {
    vol.Required(CONF_BOILER): cv.entity_id,
    vol.Required(CONF_UNIQUE_ID): str,
    vol.Required(CONF_ROOMS, default=dict): vol.All(
                    lambda v: v or {}, {util.CONF_STR_KEY: ROOM_SCHEMA}
                ),
    vol.Optional(CONF_AT_STARTUP, default=False): bool,
    vol.Optional(CONF_EVENTS, default=False): bool,
    vol.Optional(CONF_EXPR_ENV, default=None): vol.Any(
        str, None
    ),
    vol.Optional(CONF_SCH_PREPEND, default=list): vol.All(
        SCHEDULE_SCHEMA, validate_rule_paths
    ),
    vol.Optional(CONF_SCH_APPEND, default=list): vol.All(
            SCHEDULE_SCHEMA, validate_rule_paths
    ),
    vol.Optional(
        CONF_SCH_SNIPPETS, default=OrderedDict
    ): SCHEDULE_SNIPPETS_SCHEMA,
    # vol.Optional(CONF_ROOMS, default=OrderedDict): vol.All(
    #     lambda v: v or OrderedDict, {util.CONF_STR_KEY: ROOM_SCHEMA}
    # ),
    vol.Optional(CONF_NAME, default=DEFAULT_NAME): cv.string,
}
