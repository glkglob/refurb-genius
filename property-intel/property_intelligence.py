from crewai import Agent, Task, Crew, Process
from langchain_groq import ChatGroq
from crewai_tools import SerperDevTool, ScrapeWebsiteTool

# Models - Grok for manager, cheaper model for workers
llm_grok = ChatGroq(model="grok-beta", temperature=0.3)
llm_cheap = ChatGroq(model="llama3-70b-8192", temperature=0.2)

search_tool = SerperDevTool()
scrape_tool = ScrapeWebsiteTool()

# Agents
manager = Agent(
    role="Property Intelligence Manager",
    goal="Deliver clear, high-quality property intelligence reports",
    backstory="Senior property analyst who coordinates specialists and produces investor-ready insights.",
    llm=llm_grok,
    verbose=True
)

researcher = Agent(
    role="Property Researcher",
    goal="Find all important data about any UK property",
    backstory="Meticulous researcher skilled at finding property details, market data, and history.",
    tools= ,
    llm=llm_cheap,
    verbose=True
)

refurb_analyst = Agent(
    role="Refurbishment Cost Expert",
    goal="Accurately estimate renovation costs and required work",
    backstory="Experienced builder who gives realistic refurbishment costs and timelines.",
    tools= ,
    llm=llm_cheap,
    verbose=True
)

# Tasks
research_task = Task(
    description="Research the property thoroughly. Extract location, price, size, condition, market trends, and any red flags.",
    agent=researcher,
    expected_output="Detailed property research report"
)

refurb_task = Task(
    description="Based on the research, estimate the refurbishment scope and realistic total cost. Break down by major categories like kitchen, bathroom, electrics, etc.",
    agent=refurb_analyst,
    expected_output="Refurbishment cost breakdown with total estimate"
)

final_task = Task(
    description="Combine the research and refurb analysis into a clear, professional property intelligence report. Include key insights and recommendations.",
    agent=manager,
    expected_output="Final professional property report",
    context= )

# Crew
crew = Crew(
    agents= ,
    tasks= ,
    process=Process.sequential,
    verbose=True
)

# Run it
result = crew.kickoff(inputs={"property": "Add the full property address here"})
print(result)
