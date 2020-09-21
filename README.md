# Wiser Home integration with Home Assistant by [Kinori Tech](http://knori.tech)

This project provides a custom Home Assistant component for [Wiser Home](https://wiser.draytoncontrols.co.uk/support-getting-started) multi-zone heating and an accompanying Lovelave Card.

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE)

## Requirements

You must be using Wiser [Smart Radiator Thermostats](https://wiser.draytoncontrols.co.uk/smart-radiator-thermostat) via [zigbee2mqtt](https://www.zigbee2mqtt.io/devices/WV704R0A0902.html) integration.

You must have a *switch* in Home Assistant that allows control of the `on/off` state of the boiler used in your heating system.


## Installation

1. Download the latest release and unzip it to your preffered location.
2. Copy the `wiser_home` folder  to your `<home-assistant>\configuration\custom_compononets` folder. Where *\<home-assistant\>* is the location of your Home Assistant installation or configuration path.
3. Copy the `wiser-home-card.js` to the `<home-assistant>\configuration\www` folder.
4. Restart your Home Assistant service.

**Note:** You don't need the lovelave card for the HA component to work, is just a useful way of monitoring the TRVs and to use additional features.

## Configuration (wiser-come component)
The component must be added to HA as a sensor (e.g. to your `senor.yaml` file.) using the **wiser_home** platform.
The component allows you to configure the different rooms in your house. Each room can have 1 or more TRVs. Each room can have its own schedule and/or you can have a general schedule. The structure is as follows:
```yaml
- platform: wiser_home
  boiler: <boiler switch id>
  rooms:
    <room_name>:
      thermostat:
        - entity_id: <HA TRV id>
      schedule:
        - v: 16
    schedule_append:
      - v: "OFF"
``` 

### Configuration variables
* **bolier**    \<switch.id\>    REQUIRED<br/>Id of the swtich to control the boiler `on/off`

* **rooms**    \<map\>    REQUIRED<br/>Information about the rooms in the house. The *key* is the room name and the value ifs a room configuration.

  * **room**  \<map\>    REQUIRED<br/>Information about the room.

    * **thermostat** \<map\> REQUIRED (MULTIPLE)<br/>A list of Wiser Home TRV entities installed in the room (i.e. a room can have multiple radiators) and their weights.
   
      * **entity_id**  \<climate.id\> REQUIRED<br/>Id of the Wiser Home TRV climate entity
  
      * **weight**  \<number>  OPTIONAL (default 1.0)<br/>Specify how individual values should be weighted when calculating the average temperature value for rooms with multiple radiators. Use this value to indicate that a radiators are of different size and thus, one raditaor will have more influence in the room temperature than the other. A raditaor with a weight of 2 will have a bigger contribution to the room average temperature. The default weight is 1 and a weight of 0 causes the value to be excluded completely.
    * **schedule**  \<Schedy\> OPTIONAL<br\>The schedule for the room. Uses the same format as [Schedy](https://hass-apps.readthedocs.io/en/stable/apps/schedy/); please refer to their excellent online documentation to learn how to create schedules. [efficiosoft](https://github.com/efficiosoft) has done a great job with them! Currently, temperatures can only be specified in °C.
  * **schedule_append**  \<Schedy\> OPTIONAL<br\>The fall-back schedule for all rooms. Uses the same format as [Schedy](https://hass-apps.readthedocs.io/en/stable/apps/schedy/); 

### Example

```yaml
- platform: wiser_home
    boiler: switch.el_switch_1_switch
    rooms:
      master:
        thermostat:
          - entity_id: climate.dw_valve_3_climate
        schedule:
          - v: 16  # Room always at 16°C
      living:
        thermostat:
          - entity_id: climate.dw_valve_5_climate
        schedule:
          # Living room at 18°C between Nov-Mar in the night
          - v: 18
            months: 1-3, 11-12  
            rules:
              - { start: "19:00", end: "22:00" }
      kitchen:
        thermostat:
          - entity_id: climate.dw_valve_1_climate
        schedule:
          - v: 20
            months: 1-3, 11-12
            rules:
              - weekdays: 1-5
                rules:
                  - { start: "06:15", end: "07:30" }
                  - { start: "11:45", end: "13:00" }
              - weekdays: 6-7
                rules:
                  - { start: "07:00", end: "09:00" }
    schedule_append:
      # All rooms default to OFF if not in schedule
      - v: "OFF"
```

# Using the lovelace card

Just go to your desired UI page and add a new **Manual Card**. When prompted, provide the correct type: `type: 'custom:wiser-home-card`. After you have added the card, edit it and select your `wiser_home` component to monitor.

**Note:** The lovelave card is work in progress, so currently it only displays the room information (temp, setpoint,  heat demand). 

## Services

The HA component currently offers two services in order to enable and configure away mode:
- Away mode
- Away temp

The away mode service, `wiser_home.set_away_mode`, allows you to Activate/desactivate (true/false) the away mode. When *active*, the component ignores the schedule of the rooms and sets all valves to the away temp, by default its 16°C.

The away temp service, `wiser_home.set_away_temp`, allows you to change the away temperature. 

You can invoke the services via the UI or, for example, you could use a location automation to set away mode when everyone leaves the house. 

## Be kind, rewind :)

If you found this component helpful consider chipping in for a :beer: or a :coffee:!

[![coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/KinoriTech)

