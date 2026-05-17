class Project:
    def __init__(self, name, value, days_remaining):
        self.name = name
        self.value = value
        self.days_remaining = days_remaining
    
    def get_status(self):
        if self.days_remaining < 0:
            return "OVERDUE"
        elif self.days_remaining == 0:
            return "DUE TODAY"
        elif self.days_remaining <= 7:
            return "DUE THIS WEEK"
        else:
            return "ON TRACK"
        

project1 = Project("Dubai Mall Campaign", 15000, -2)
project2 = Project("Abu Dhabi Launch", 8500, 5)
project3 = Project("Ramadan Collection", 12000, 15)

projects = [project1, project2, project3]

for project in projects:
    status = project.get_status()
    print(project.name, "→", status, "| Value: $", project.value)