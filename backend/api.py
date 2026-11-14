from fastapi import FastAPI, HTTPException
from backend.realtime import get_departures, ROUTES
import requests

app = FastAPI() #creates our web app

@app.get("/departures/{route}") #when someone sends a GET request to /departures, run function below
def departures(route: str):
    route = route.lower() # widget sends "BE-UN", keys are lowercase
    if route not in ROUTES:
        raise HTTPException(status_code=400, detail="Unknown route") #this is important to someone can't spam the server for a bunch of requests for a route that don't exist 
    
    stop_code, direction_name = ROUTES[route]
    try:
        return get_departures(stop_code, direction_name)
    except (requests.RequestException, RuntimeError): #in case Go API server is down or something and we j can't fetch data, we don't want bugs or glithces, just a clear msg that we can't get data
        # if we change timeout in realtime.py to 0.001s, then our error handling works correctly. it says couldnt fetch data because the sever didn't respond in 0.001s. normally, if it takes >10s then we also raise this same error
        raise HTTPException(status_code=502, detail="Couldn't fetch data")
    #uvicorn is our web server, listening to the port and passing in our requests to fastAPI