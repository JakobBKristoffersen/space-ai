"# space-ai" 




# Space center layout and different launch sequence ()

Convert Enterprise to Space Center
 
  - Launch pad (Shows stats and upgrades)     
     - Can cancel launch
     - can be upgraded to launch larger rockets (mass)
  - Communication Center 
     - Can send and receive messages to and from rockets
     - Can be upgraded to send and receive more messages (b/s)
     - Display a small databank
     - Can be upgraded to store more data
     - Add button to clear databank
  - Tracking Station      
     - Can be upgraded to allow more rockets
  - Research Center  (Move Research Page in here as well)
     - Here player can unlock more vehicle parts
     - Here player can unlock more vehicle layouts in the VAB
  - Mission Control  (Missions page is moved in here)         
  - Vehicle Assembly Building
   - Player can build rockets here
   - Player can select a layout/template to build the rocket on
   - a layout is a set of parts that can be combined to build a rocket
   - a layout is unlocked by upgrading the VAB
   - a layout determines the template which parts can be attached too
   - so a layout is a skeleton of a rocket with placeholders for parts 
   - the player can then add parts to the skeleton to build a rocket
   - the player can remove parts from the skeleton to build a different rocket
   - the first three layouts looks like
    - 1) Basic; 
      Upper Stage
        Nose (1x Cone, 1x Guidance System, 1x Science Experiment, 1x Antenna, 1x Parachute) 
        Body (1x Fuel Tank, 1x Fins) 
        Tail (1x: engine) 
      
    - 2) Tier 2 (find a good name); 
      Upper Stage
        Nose (1x Cone and 1x Guidance System, 1x Battery, 2x Science Experiment, 1x Parachute)
        Body (1x Fuel Tank, 1x Reaction Wheel, 1x Fins) 
        Tail (1x, engine)
      Lower Stage
        Body (1x Fuel Tank, 1x Fins) 
        Tail (1x, engine)
    - 3) Tier 3 (find a good name); 
      Upper Stage
          Nose (1x Cone and 1x Guidance System, 1x Battery, 2x Science Experiment, 1x Antenna, 1x Parachute)
          Body (2x Fuel Tank, 1x Reaction Wheel, 1x Fins, 1x Large Science Experiment, 2x Solar Panels) 
          Tail (1x Heat Shield)
      Mid Stage
          Body (2x Fuel Tank, 1x Fins) 
          Tail (1x, engine)
      Lower Stage
          Body (2x Fuel Tank, 1x Fins) 
          Tail (1x, engine)
  - The player should name vehicle
  - The player should assign the script to the vehicle like before
  - make a launch button which will change the rocket to "launched" state and move UI to World Page
  - In the World Page, if launch is reset, the rocket should be changed to "not launched" state and move UI to VAB Page
  - No changes can be done to the rocket once it is launched
  - All changes will be applied on a new launch


The player start with no rocket and should build one in the VAB. Each parts cost money and there should be enough money to build a basic rocket. (1x. Cone, 1x Fuel Tank, 1x Engine, 1x guidance system, 1x battery, 1x fins)  

Implement the missing parts 
  - Fins (Their should allow for turning the rocket when there is a positive air density. The rocket now only starts with fins).  
     - The RocketAPI should remain the same if the script is turning (either the fins or the reaction wheel), however the fins are much more effective at turning the rocket if there is a positive air density based on rockets velocity. 
     - The fins should be able to be upgraded to allow for more effective turning (find a good name for this). 
  - The Cone determines drag and max heat (infront of rocket). Make two version (basic with more drag and low heat resistance), second with less drag but still low heat ressitance (find a good name for this). 
  - Parachute 
     - Parachute should be able to be deployed to slow down the rocket, however once deployed it should not be possible to deploy again
     - Parachute should be able to be upgraded to allow for more effective slowing down (find a good name for this). 
  - Heat Shield
     - Heat Shield should be able to be deployed to protect the rocket from heat from the bottom of the rocket
     - Heat Shield should be able to be upgraded to allow for more effective protection from heat (find a good name for this). 

Display heat on the rocket divided into top and bottom. If any of the heat is above the max heat of the part, the rocket should be destroyed. 

First science experiment:
 Atmospheric Pressure Scan:
  - Provides Atmospheric pressure at the location of the rocket
 Temperature Scan:
  - Provides Temperature at the location of the rocket

Drop General Upgrades Heating Protection Levels. It is now the parts responsibility to handle this and it is divided into heat resistance and heat generation. The source of heat can be from the top of the rocket (flying straight through the atmosphere) or from the bottom (flying through the atmosphere with bottom of rocket pointing down, so when it reenters the atmosphere). 



# scripts
  improve the RocketAPI to be more clear a bit modular

  Make a small API documentation which only shows what is unlocked


# improve dev debugger. 
 Make a complete debugger toolbox
  - Easy to add more money
  - Easy to add more research points
  - Easy to reset application state (remove all app data)

 
